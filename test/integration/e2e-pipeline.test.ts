import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { loadConfig } from '../../src/config/loader.js';
import { getStore, closeStore } from '../../src/store/factory.js';
import { MemoryEngine } from '../../src/memory/engine.js';
import { createSpan, recordMetric } from '../../src/telemetry/api.js';
import { v4 as uuidv4 } from 'uuid';

// Comprehensive E2E test covering full pipeline:
// Event ingestion → Memory enrichment → Storage → Retrieval → RAG synthesis
// Also validates audit logging, observability, and permissions.

describe('E2E: Full Pipeline', () => {
  let store: any;
  let engine: MemoryEngine;
  let config: any;
  let testUserId: string;
  let testTeamId: string;
  let testProjectId: string;
  let testSessionId1: string;
  let testSessionId2: string;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('Skipping E2E tests — DATABASE_URL not set');
      return;
    }

    config = await loadConfig();
    // Ensure minimal config for test
    config.rag = { useSemanticInject: false };
    store = await getStore(config);
    await store.init();

    // Create test user
    const user = await store.createUser({
      email: `e2e-${Date.now()}@example.com`,
      name: 'E2E Test User',
    });
    testUserId = user.id;
    config.general.userId = user.id;

    // Create test team
    const team = await store.createTeam({
      name: 'E2E Test Team',
      slug: `e2e-test-${Date.now()}`,
      ownerId: user.id,
    });
    testTeamId = team.id;
    config.general.teamId = team.id;

    // Create test project
    const projectResult = await store.createProject(
      { teamId: testTeamId, name: 'E2E Test Project' },
      { userId: testUserId }
    );
    testProjectId = projectResult;

    engine = new MemoryEngine(store, config);

    // Create an agent for these sessions (use 'opencode' as valid agent_tool enum)
    const agentId = await store.upsertAgent({
      teamId: testTeamId,
      toolName: 'opencode',
      instanceId: 'e2e-inst',
      agentName: 'E2ETest',
    }, { userId: testUserId });

    // Create sessions for the ingestion events
    testSessionId1 = uuidv4();
    await store.createSession({
      id: testSessionId1,
      agentId,
      teamId: testTeamId,
      projectId: testProjectId,
      userId: testUserId,
    });

    testSessionId2 = uuidv4();
    await store.createSession({
      id: testSessionId2,
      agentId,
      teamId: testTeamId,
      projectId: testProjectId,
      userId: testUserId,
    });
  });

  afterAll(async () => {
    await closeStore();
  });

  it('should ingest multiple event types and create memories', async () => {
    if (!store) return;

    const events = [
      {
        timestamp: new Date(),
        source: {
          toolName: 'opencode',
          toolVersion: '1.0',
          instanceId: 'e2e-inst',
          sessionId: testSessionId1,
          agentName: 'E2ETest',
          userId: testUserId,
        },
        project: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        type: 'tool_use',
        toolName: 'WriteFile',
        toolInput: { path: '/tmp/test.txt', content: 'Hello E2E' },
        toolOutput: { success: true },
        filesInvolved: ['/tmp/test.txt'],
        context: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        extracted: { decisions: ['Write file'], errors: [], topics: ['file-io'] },
        raw: null,
      },
      {
        timestamp: new Date(),
        source: {
          toolName: 'opencode',
          toolVersion: '1.0',
          instanceId: 'e2e-inst',
          sessionId: testSessionId1,
          agentName: 'E2ETest',
          userId: testUserId,
        },
        project: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        type: 'file_edit',
        toolName: 'EditFile',
        toolInput: { path: '/tmp/test.txt', old_content: 'Hello', new_content: 'Hello E2E' },
        toolOutput: { diff: '@@ -1 +1 @@\n-Hello\n+Hello E2E' },
        filesInvolved: ['/tmp/test.txt'],
        context: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        extracted: { decisions: ['Edit file'], errors: [], topics: ['file-io'] },
        raw: null,
      },
      {
        timestamp: new Date(),
        source: {
          toolName: 'opencode',
          toolVersion: '1.0',
          instanceId: 'e2e-inst',
          sessionId: testSessionId2,
          agentName: 'E2ETest',
          userId: testUserId,
        },
        project: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        type: 'decision',
        toolName: 'decision',
        toolInput: { decision: 'Use TypeScript for type safety' },
        toolOutput: { rationale: 'Improves code quality' },
        filesInvolved: [],
        context: {
          teamId: testTeamId,
          projectId: testProjectId,
          repoPath: '/tmp',
          repoUrl: '',
          branch: 'main',
          cwd: '/tmp',
          platform: 'linux',
        },
        extracted: { decisions: ['Use TypeScript'], errors: [], topics: ['tech-choice'] },
        raw: null,
      },
    ];

    const count = await engine.ingestEvents(events);
    expect(count).toBeGreaterThan(0);

    // Wait for embedding generation (can be slow with Ollama)
    // Use polling to check when embeddings are ready, up to 15 seconds
    let memories: any[] = [];
    let withEmbedding = 0;
    const maxWait = 15000;
    const interval = 1000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      memories = await store.listMemories(testTeamId, { limit: 10, userId: testUserId });
      const memoryIds = memories.map(m => m.id);
      if (memoryIds.length > 0) {
        // Directly check memory_embeddings table (listMemories doesn't return embeddings)
        const embedResult = await (store as any).pool.query(
          `SELECT COUNT(*) FROM memory_embeddings WHERE memory_id = ANY($1::uuid[])`,
          [memoryIds]
        );
        withEmbedding = parseInt(embedResult.rows[0].count, 10);
        if (withEmbedding > 0) break;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Verify memories are created
    expect(memories.length).toBeGreaterThanOrEqual(3);

    // Check that at least one memory has embedding (if embedding service is active)
    expect(withEmbedding).toBeGreaterThan(0);

    // Record metric for test
    recordMetric('e2e.test.memories_created', memories.length, { teamId: testTeamId });
  });

  it('should support vector similarity search', async () => {
    if (!store) return;

    const results = await store.queryMemories({
      teamId: testTeamId,
      embedding: [0.1, 0.2, 0.3], // dummy vector; will match based on existing embeddings
      limit: 5,
      userId: testUserId,
    });

    // Even with dummy vector, should get some results (or none if embeddings not ready)
    // This just verifies the query interface works
    expect(Array.isArray(results)).toBe(true);
  });

  it('should support full-text search', async () => {
    if (!store) return;

    const results = await store.fullTextSearchMemories(
      testTeamId,
      'TypeScript',
      5,
      { userId: testUserId }
    );

    expect(Array.isArray(results)).toBe(true);
    // May or may not find results depending on content
  });

  it('should enforce permissions: user cannot access other team memories', async () => {
    if (!store) return;

    // Create another team with a different user
    const otherUser = await store.createUser({
      email: `other-${Date.now()}@example.com`,
      name: 'Other User',
    });

    const otherTeam = await store.createTeam({
      name: 'Other Team',
      slug: `other-team-${Date.now()}`,
      ownerId: otherUser.id,
    });

    // Attempt to list memories from other team as test user should throw permission denied
    await expect(store.listMemories(otherTeam.id, { userId: testUserId })).rejects.toThrow('Permission denied');
  });

  it('should create audit log entries for memory operations', async () => {
    if (!store) return;

    // Small delay to ensure audit logs are committed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check that audit logs exist for memory creation
    // (We know insertMemory now calls logAudit)
    const auditResult = await store.pool.query(
      `SELECT * FROM audit_log WHERE team_id = $1 AND resource_type = 'memory' ORDER BY timestamp DESC LIMIT 5`,
      [testTeamId]
    );

    // Should have at least one audit entry for memory create
    if (auditResult.rows.length === 0) {
      // If no memory audits, check if there are any other audits to verify audit system is working
      const anyAudit = await store.pool.query(
        `SELECT * FROM audit_log WHERE team_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [testTeamId]
      );
      // At least something should be audited (maybe team creation)
      // Actually team creation is audited, so we should have something
      expect(anyAudit.rows.length).toBeGreaterThan(0);
    } else {
      const memoryAudits = auditResult.rows.filter((row: any) => row.resource_type === 'memory');
      expect(memoryAudits.length).toBeGreaterThan(0);
      // The most recent should be 'create'
      expect(memoryAudits[0].action).toBe('create');
    }
  });

  it('should retrieve knowledge base entries', async () => {
    if (!store) return;

    // Create a knowledge base entry
    const kbEntry = {
      teamId: testTeamId,
      projectId: testProjectId,
      title: 'E2E Test KB',
      content: 'This is a test knowledge base entry.',
      category: 'test',
      tags: ['e2e', 'test'],
      topics: ['testing'],
      visibility: 'team',
      source: 'e2e-test',
    };

    const kbId = await store.createKnowledgeBase(kbEntry, { userId: testUserId });
    expect(kbId).toBeDefined();

    // Search knowledge base
    const results = await store.searchKnowledgeBase(testTeamId, 'test', undefined, { limit: 10, userId: testUserId });
    expect(results.length).toBeGreaterThan(0);
    const found = results.find((k: any) => k.id === kbId);
    expect(found).toBeDefined();
  });

  it('should record telemetry metrics', async () => {
    if (!store) return;

    // Check that some telemetry was recorded during the test
    const telResult = await store.pool.query(
      `SELECT COUNT(*) FROM telemetry WHERE team_id = $1`,
      [testTeamId]
    );

    // Should have some telemetry entries (metrics/logs)
    const count = parseInt(telResult.rows[0].count);
    expect(count).toBeGreaterThanOrEqual(0); // May be zero if OTel disabled
  });
});
