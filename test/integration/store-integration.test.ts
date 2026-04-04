import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PostgresStore } from '../../src/store/postgres/store.js';
import { NautalisEventSchema } from '../../src/validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// These tests require a running PostgreSQL database with DATABASE_URL env set.
// They will be skipped if DATABASE_URL is not set.

describe('PostgresStore', () => {
  let store: PostgresStore;
  const testUserId = uuidv4();
  const testTeamId = uuidv4();

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping PostgresStore tests — DATABASE_URL not set');
      return;
    }
    store = new PostgresStore(process.env.DATABASE_URL);
    await store.init();
  });

  afterAll(async () => {
    if (store) {
      await store.close();
    }
  });

  describe('insertEvent and listMemories', () => {
    it('should store event and retrieve as memory after enrichment', async () => {
      if (!store) return;

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

      const eventId = await store.insertEvent(event);
      expect(eventId).toBeDefined();

      // Allow async embedding to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const memories = await store.listMemories(testTeamId, { limit: 10, userId: testUserId });
      expect(memories.length).toBeGreaterThan(0);
      const testMemory = memories.find(m => m.content.summary.includes('echo'));
      expect(testMemory).toBeDefined();
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
});
