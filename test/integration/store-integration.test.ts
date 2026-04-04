import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { PostgresStore } from '@/store/postgres/store.js';
import { createTestUser, createTestTeam, createTestMemory } from '../factories/index.js';

// Test database configuration
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/nautalis_test';

let pool: Pool;
let store: PostgresStore;

describe('PostgresStore Integration', () => {
  beforeAll(async () => {
    // Create a pool for running migrations and setup
    pool = new Pool({ connectionString: TEST_DB_URL });

    // Wait for database to be ready (retry)
    let retries = 30;
    while (retries > 0) {
      try {
        await pool.query('SELECT 1');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Run migrations (in order)
    await runMigrations();

    // Create store instance
    store = new PostgresStore(TEST_DB_URL);
    await store.init();
  });

  afterAll(async () => {
    await store.close();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean tables before each test
    await pool.query('TRUNCATE TABLE memories RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE memory_embeddings RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE teams RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE team_members RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE events RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE knowledge_base RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE knowledge_base_embeddings RESTART IDENTITY CASCADE');
  });

  describe('User & Team Operations', () => {
    it('should create a user and team with ownership', async () => {
      const user = await store.createUser({ email: 'test@example.com', name: 'Test User' });
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');

      const team = await store.createTeam({
        name: 'Test Team',
        slug: 'test-team',
        ownerId: user.id,
      });
      expect(team.id).toBeDefined();
      expect(team.name).toBe('Test Team');
      expect(team.ownerId).toBe(user.id);
    });

    it('should add team members and retrieve team list', async () => {
      const user1 = await store.createUser({ email: 'user1@example.com' });
      const user2 = await store.createUser({ email: 'user2@example.com' });

      const team = await store.createTeam({
        name: 'Team Alpha',
        slug: 'team-alpha',
        ownerId: user1.id,
       });
       await store.addTeamMember(team.id, user2.id, 'member', { actingUserId: user1.id });

       const members = await store.getTeamMembers(team.id, { userId: user1.id });
       expect(members.length).toBe(2); // owner + member

      const teamsForUser2 = await store.getTeamsForUser(user2.id);
      expect(teamsForUser2.length).toBe(1);
      expect(teamsForUser2[0].id).toBe(team.id);
    });
  });

  describe('Memory Operations', () => {
    let teamId: string;
    let userId: string;

    beforeEach(async () => {
      const user = await store.createUser({ email: 'memtest@example.com' });
      userId = user.id;
      const team = await store.createTeam({
        name: 'Memory Team',
        slug: 'memory-team',
        ownerId: user.id,
      });
      teamId = team.id;
    });

    it('should store and retrieve a memory with full metadata', async () => {
      const memory = createTestMemory({
        agentIdentity: {
          agentId: 'test-agent',
          agentType: 'test',
          sessionId: 'sess_1',
          toolName: 'test',
          toolVersion: '1.0',
          instanceId: 'inst_1',
          userId: userId,
          agentName: 'Test',
        },
        context: {
          teamId,
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
      });

       const memoryId = await store.insertMemory(memory);
       expect(memoryId).toBe(memory.id);

       const retrieved = await store.getMemory(memoryId, { userId, teamId });
       expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(memory.id);
      expect(retrieved?.content.summary).toBe(memory.content.summary);
      expect(retrieved?.embedding).toBeDefined();
      expect(retrieved?.embedding).toHaveLength(384);
    });

    it('should query memories with filters', async () => {
      // Create several memories
      for (let i = 0; i < 5; i++) {
        const memory = createTestMemory({
          agentIdentity: {
            agentId: `agent-${i}`,
            agentType: 'test',
            sessionId: `sess_${i}`,
            toolName: 'test',
            toolVersion: '1.0',
            instanceId: `inst_${i}`,
            userId: userId,
            agentName: 'Test',
          },
          context: {
            teamId,
            projectId: 'proj_1',
            repoPath: '/repo',
            cwd: '/repo',
            platform: 'linux',
          },
          classification: {
            ...createTestMemory().classification,
            memoryType: i % 2 === 0 ? ('episodic' as const) : ('decision' as const),
          },
        });
        await store.insertMemory(memory);
      }

       const results = await store.queryMemories({
         query: '*',
         teamId,
         userId,
         memoryType: 'episodic',
         limit: 10,
       });

      expect(results.length).toBeGreaterOrEqual(3); // At least 3 episodic
    });

    it('should find similar memories by embedding', async () => {
      const mem1 = createTestMemory({
        agentIdentity: {
          agentId: 'agent-1',
          agentType: 'test',
          sessionId: 'sess_1',
          toolName: 'test',
          toolVersion: '1.0',
          instanceId: 'inst_1',
          userId: userId,
          agentName: 'Test',
        },
        context: {
          teamId,
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        embedding: Array(384).fill(0.1),
      });
      const mem2 = createTestMemory({
        agentIdentity: {
          agentId: 'agent-2',
          agentType: 'test',
          sessionId: 'sess_2',
          toolName: 'test',
          toolVersion: '1.0',
          instanceId: 'inst_2',
          userId: userId,
          agentName: 'Test',
        },
        context: {
          teamId,
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        embedding: Array(384).fill(0.2),
      });
      await store.insertMemory(mem1);
      await store.insertMemory(mem2);

       const queryEmbedding = Array(384).fill(0.15);
       const results = await store.findSimilarMemories(queryEmbedding, teamId, 5, 0.7, { userId });

      expect(results.length).toBe(2);
      // Should return sorted by similarity
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe('Knowledge Base', () => {
    let teamId: string;
    let userId: string;

    beforeEach(async () => {
      const user = await store.createUser({ email: 'kbtest@example.com' });
      userId = user.id;
      const team = await store.createTeam({ name: 'KB Team', slug: 'kb-team', ownerId: user.id });
      teamId = team.id;
    });

    it('should create and search knowledge base entries', async () => {
      const kbEngine = store.getKnowledgeBaseEngine()!;

      const entryId = await kbEngine.create({
        teamId,
        title: 'Authentication Guide',
        content: 'How to implement OAuth2 authentication...',
        contentType: 'markdown',
        category: 'guide',
        tags: ['auth', 'security'],
        topics: ['authentication', 'oauth'],
        visibility: 'team',
        source: 'manual',
        confidence: 1.0,
      });

      const entry = await kbEngine.get(entryId);
      expect(entry).toBeDefined();
      expect(entry?.title).toBe('Authentication Guide');
      expect(entry?.visibility).toBe('team');

      // Search without embedding (full-text)
      const results = await kbEngine.search(teamId, 'authentication');
      expect(results.length).toBeGreaterOrEqual(1);
    });
  });

  describe('Permissions & RLS', () => {
    it('should enforce team membership checks', async () => {
      const user1 = await store.createUser({ email: 'u1@example.com' });
      const user2 = await store.createUser({ email: 'u2@example.com' });
      const team = await store.createTeam({
        name: 'Secure Team',
        slug: 'secure-team',
        ownerId: user1.id,
      });

      // user2 is not a member
      const hasPerm = await store.checkPermission(user2.id, team.id, 'memory', 'read');
      expect(hasPerm).toBe(false);

       // Add user2 as member
       await store.addTeamMember(team.id, user2.id, 'member', { actingUserId: user1.id });
       const hasPermAfter = await store.checkPermission(user2.id, team.id, 'memory', 'read');
      expect(hasPermAfter).toBe(true);
    });
  });
});

/**
 * Run all migrations in order
 */
async function runMigrations(): Promise<void> {
  const migrationFiles = [
    // Core migrations
    'migrations/postgres/core/001_extensions.sql',
    'migrations/postgres/core/002_enums.sql',
    'migrations/postgres/core/003_users_teams.sql',
    'migrations/postgres/core/004_permissions.sql',
    'migrations/postgres/core/005_projects_agents.sql',
    'migrations/postgres/core/006_events_memories.sql',
    'migrations/postgres/core/007_knowledge_base.sql',
    'migrations/postgres/core/008_audit_log.sql',
    // TimescaleDB
    'migrations/postgres/timescaledb/001_hypertables.sql',
    'migrations/postgres/timescaledb/002_telemetry_hypertable.sql',
    'migrations/postgres/timescaledb/003_continuous_aggregates.sql',
    // RLS
    'migrations/postgres/rls/001_rls_policies.sql',
    'migrations/postgres/rls/002_functions.sql',
  ];

  for (const file of migrationFiles) {
    const sql = await Bun.file(file).text();
    try {
      await pool.query(sql);
      console.log(`✓ Migration applied: ${file}`);
    } catch (error) {
      console.error(`✗ Migration failed: ${file}`);
      throw error;
    }
  }
}
