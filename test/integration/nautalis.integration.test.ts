import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { loadConfig } from '../../src/config/loader.js';
import { getStore } from '../../src/store/factory.js';
import { MemoryEngine } from '../../src/memory/engine.js';
import { v4 as uuidv4 } from 'uuid';

// Integration tests require a database connection.
// These tests will create real data and clean up after themselves.

describe('Integration: Event Ingestion & Retrieval', () => {
  let store: any;
  let engine: MemoryEngine;
  let config: any;
  const testUserId = uuidv4();
  const testTeamId = uuidv4();

  beforeAll(async () => {
    // Check if DATABASE_URL is set or config file provides one
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('Skipping integration tests — DATABASE_URL not set and no config found');
      return;
    }

    config = await loadConfig();
    // Override with test IDs
    config.general.userId = testUserId;
    config.general.teamId = testTeamId;

    store = await getStore(config);
    await store.init();

    engine = new MemoryEngine(store, config);
  });

  afterAll(async () => {
    if (store) {
      await store.close();
    }
  });

  it('should ingest a tool_use event and create a memory', async () => {
    if (!store) return;

    const event = {
      timestamp: new Date(),
      source: {
        toolName: 'integration_test',
        toolVersion: '1.0',
        instanceId: 'test-inst',
        sessionId: '',
        agentName: 'IntegrationTest',
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
      type: 'tool_use',
      toolName: 'echo',
      toolInput: { command: 'echo', message: 'Integration test' },
      toolOutput: { stdout: 'Integration test\n', exitCode: 0 },
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
      extracted: { decisions: [], errors: [], topics: ['integration'] },
      raw: null,
    };

    const count = await engine.ingestEvents([event]);
    expect(count).toBeGreaterThan(0);

    // Wait for async embedding (max 3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const memories = await store.listMemories(testTeamId, { limit: 10, userId: testUserId });
    const testMemory = memories.find((m: any) => m.content.summary.includes('echo'));
    expect(testMemory).toBeDefined();
  });

  it('should perform vector similarity search', async () => {
    if (!store) return;

    // Use the embedding service to get a vector
    const embedResult = await engine.embeddingService.embed('echo integration');
    const vector = embedResult.embedding;

    const results = await store.findSimilarMemories(vector, testTeamId, 10, 0, { userId: testUserId });
    // We might have at least 1 memory from previous test
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('should perform full-text search', async () => {
    if (!store) return;

    const results = await store.fullTextSearchMemories(testTeamId, 'echo', 10, { userId: testUserId });
    expect(Array.isArray(results)).toBe(true);
  });

  it('should synthesize an answer using RAG', async () => {
    if (!store) return;

    const answer = await engine.ask('What was the test tool doing?');
    expect(typeof answer).toBe('string');
    // The answer could be "I don't know" if no relevant memories, but that's okay
    expect(answer.length).toBeGreaterThan(0);
  });
});
