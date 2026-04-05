import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { PostgresStore } from '../../src/store/postgres/store.js';
import { MemoryEngine } from '../../src/memory/engine.js';
import { loadConfig } from '../../src/config/loader.js';
import { NautalisEventSchema } from '../../src/validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// These tests require a running PostgreSQL database with DATABASE_URL env set.
// They will be skipped if DATABASE_URL is not set.

describe('PostgresStore', () => {
   let store: PostgresStore;
   let engine: MemoryEngine;
   let testUserId: string;
   let testTeamId: string;

   beforeAll(async () => {
     if (!process.env.DATABASE_URL) {
       console.log('Skipping PostgresStore tests — DATABASE_URL not set');
       return;
     }
     store = new PostgresStore(process.env.DATABASE_URL);
     await store.init();

     // Load config for engine
     const config = await loadConfig();
     config.general.userId = ''; // will set after user creation
     config.general.teamId = '';  // will set after team creation

     // Create test user
     const user = await store.createUser({
       email: `test-${Date.now()}@example.com`,
       name: 'Test User',
     });
     testUserId = user.id;
     config.general.userId = user.id;

     // Create test team with user as owner
     const team = await store.createTeam({
       name: 'Test Team',
       slug: `test-team-${Date.now()}`,
       ownerId: user.id,
     });
     testTeamId = team.id;
     config.general.teamId = team.id;

      // Ensure team membership exists (createTeam should have done this, but ensure)
      const client = (store as any).pool;
      let tmCheck = await client.query('SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2', [testTeamId, testUserId]);
      if (tmCheck.rows.length === 0) {
        await client.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [testTeamId, testUserId, 'owner']);
      }

      // Initialize MemoryEngine
      engine = new MemoryEngine(store, config);
    });

   afterAll(async () => {
    if (store) {
      await store.close();
    }
  });

   describe('insertEvent and listMemories', () => {
     it('should store event and retrieve as memory after enrichment', async () => {
       if (!store || !engine) return;

       const event = {
         eventId: uuidv4(),
         timestamp: new Date(),
         source: {
           toolName: 'test',
           toolVersion: '1.0',
           instanceId: 'test-instance',
           sessionId: '',
           agentName: 'TestAgent',
           userId: testUserId,
         },
         project: {
           teamId: testTeamId,
           projectId: '',
           repoPath: '/tmp',
           repoUrl: '',
           branch: '',
           cwd: '/tmp',
           platform: 'linux',
         },
         type: 'tool_use' as const,
         toolName: 'echo',
         toolInput: { command: 'echo', message: 'hello' },
         toolOutput: { stdout: 'hello\n', exitCode: 0 },
         filesInvolved: [],
         context: {
           teamId: testTeamId,
           projectId: '',
           repoPath: '/tmp',
           repoUrl: '',
           branch: '',
           cwd: '/tmp',
           platform: 'linux',
         },
         extracted: { decisions: [], errors: [], topics: ['test'] },
         raw: null,
       };

       const count = await engine.ingestEvents([event]);
       expect(count).toBeGreaterThan(0);

       // Allow async embedding to complete
       await new Promise(resolve => setTimeout(resolve, 2000));

       const memories = await store.listMemories(testTeamId, { limit: 10, userId: testUserId });
       expect(memories.length).toBeGreaterThan(0);
      });
    });

    describe('knowledge base', () => {
     it('should create and search knowledge base entry', async () => {
       if (!store) return;

       const kbId = await store.createKnowledgeBase(
         {
           teamId: testTeamId,
           title: 'Test KB Entry',
           content: 'This is a test knowledge base entry.',
           category: 'test',
           visibility: 'team',
         },
         { userId: testUserId }
       );
       expect(kbId).toBeDefined();

       const results = await store.searchKnowledgeBase(testTeamId, 'test', undefined, { userId: testUserId });
       expect(results.length).toBeGreaterThan(0);
       const entry = results.find(kb => kb.title === 'Test KB Entry');
       expect(entry).toBeDefined();
     });
   });

    describe('memory CRUD operations', () => {
      let testMemoryId: string = '';

      it('should create a memory via ingest and retrieve it', async () => {
        if (!store || !engine) return;

        const event = {
          eventId: uuidv4(),
          timestamp: new Date(),
          source: {
            toolName: 'test',
            toolVersion: '1.0',
            instanceId: 'test-instance',
            sessionId: '',
            agentName: 'TestAgent',
            userId: testUserId,
          },
          project: {
            teamId: testTeamId,
            projectId: '',
            repoPath: '/tmp',
            repoUrl: '',
            branch: '',
            cwd: '/tmp',
            platform: 'linux',
          },
          type: 'tool_use' as const,
          toolName: 'echo',
          toolInput: { command: 'echo', message: 'hello' },
          toolOutput: { stdout: 'hello\n', exitCode: 0 },
          filesInvolved: [],
          context: {
            teamId: testTeamId,
            projectId: '',
            repoPath: '/tmp',
            repoUrl: '',
            branch: '',
            cwd: '/tmp',
            platform: 'linux',
          },
          extracted: { decisions: [], errors: [], topics: ['test'] },
          raw: null,
        };

        const count = await engine.ingestEvents([event]);
        expect(count).toBeGreaterThan(0);

        // Wait for embedding
        await new Promise(resolve => setTimeout(resolve, 2000));

        const memories = await store.listMemories(testTeamId, { limit: 10, userId: testUserId });
        expect(memories.length).toBeGreaterThan(0);
        const memory = memories[0];
        testMemoryId = memory.id;

        // Verify we can get the memory by ID
        const fetched = await store.getMemory(testMemoryId, { userId: testUserId });
        expect(fetched).toBeDefined();
        expect(fetched.id).toBe(testMemoryId);
      });

      it('should update memory', async () => {
        if (!store || !testMemoryId) return;

        const updates = {
          content: {
            summary: 'Updated summary',
            detail: 'Updated detail',
            filesInvolved: [],
            commandsExec: [],
            errorsSeen: [],
            codeSnippets: [],
          },
        };
        const success = await store.updateMemory(testMemoryId, updates, { userId: testUserId });
        expect(success).toBeTrue();

        const updated = await store.getMemory(testMemoryId, { userId: testUserId });
        expect(updated.content.summary).toBe('Updated summary');
      });

       it('should delete memory', async () => {
         if (!store || !testMemoryId) return;

         const success = await store.deleteMemory(testMemoryId, { userId: testUserId });
         expect(success).toBeTrue();

         const deleted = await store.getMemory(testMemoryId, { userId: testUserId });
         expect(deleted).toBeNull();
       });
     });

  }); // close outer describe('PostgresStore')
