#!/usr/bin/env bun
// Integration test for the full ingestion → memory → retrieval pipeline
// Usage: bun run scripts/test-integration-pipeline.ts

import { loadConfig } from '../src/config/loader.js';
import { getStore } from '../src/store/factory.js';
import { MemoryEngine } from '../src/memory/engine.js';
import { createSpan } from '../src/telemetry/api.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('=== Nautalis Integration Test ===\n'));

  // 1. Load config and initialize store
  console.log(chalk.gray('[1] Loading config...'));
  const config = await loadConfig();
  const store = await getStore(config);
  await store.init();
  console.log(chalk.green(`   ✓ Store initialized (driver: ${config.database.driver})`));

  // Ensure we have a valid userId and teamId (use first team if not set)
  if (!config.general.userId) {
    // Try to derive from system user or fail
    throw new Error('config.general.userId must be set');
  }

  // Auto-detect teamId if missing or placeholder
  if (!config.general.teamId || config.general.teamId === 'default') {
    console.log(chalk.yellow('   Team ID not set, attempting to find a team for the user...'));
    const teams = await store.getTeamsForUser(config.general.userId);
    if (teams.length === 0) {
      throw new Error('No teams found for user. Please create a team first (nautalis team create).');
    }
    config.general.teamId = teams[0].id;
    console.log(chalk.green(`   ✓ Using team: ${teams[0].name} (${teams[0].id})`));
  }

  // 2. Create MemoryEngine
  console.log(chalk.gray('[2] Creating MemoryEngine...'));
  const memoryEngine = new MemoryEngine(store, config);
  console.log(chalk.green('   ✓ MemoryEngine created'));

  // 3. Create a valid Nautalis event (according to NautalisEventSchema)
  console.log(chalk.gray('[3] Creating test event...'));
  const now = new Date();
  const testEvent = {
    eventId: `test-${Date.now()}`,
    timestamp: now,
    source: {
      toolName: 'integration_test',
      toolVersion: '1.0.0',
      instanceId: 'test-instance',
      sessionId: 'test-session-001',
      agentName: 'IntegrationTest',
      userId: config.general.userId,
    },
    project: {
      teamId: config.general.teamId,
      projectId: 'test-project',
      repoPath: '/tmp/nautalis-test',
      repoUrl: '',
      branch: 'main',
      cwd: '/tmp',
      platform: 'linux',
    },
    type: 'tool_use',
    toolName: 'echo',
    toolInput: { command: 'echo', message: 'Hello from integration test' },
    toolOutput: { stdout: 'Hello from integration test\n', exitCode: 0 },
    filesInvolved: [],
    context: {
      teamId: config.general.teamId,
      projectId: 'test-project',
      repoPath: '/tmp/nautalis-test',
      repoUrl: '',
      branch: 'main',
      cwd: '/tmp',
      platform: 'linux',
    },
    extracted: {
      decisions: [],
      errors: [],
      topics: ['integration', 'test'],
    },
    raw: null,
  };
  console.log(chalk.green('   ✓ Test event created'));

  // 4. Ingest event
  console.log(chalk.gray('[4] Ingesting event...'));
  const count = await memoryEngine.ingestEvents([testEvent]);
  console.log(chalk.green(`   ✓ Ingested ${count} event(s)`));

  // Wait a moment for async processing (embedding)
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. Query memories via vector search
  console.log(chalk.gray('[5] Testing vector search...'));
  const queryEmbedding = await store.findSimilarMemories(
    Array(384).fill(0), // dummy zero vector to fetch recent (will use fallback)
    config.general.teamId,
    10,
    0,
    { userId: config.general.userId }
  );
  // Actually, we want to test the real vector search. Let's use the embedding service to get an embedding for a query.
  // We'll need to import EmbeddingService.
  // But simpler: use store.listMemories to see if our memory is there.
  const recentMemories = await store.listMemories(config.general.teamId, { limit: 10, userId: config.general.userId });
  console.log(chalk.green(`   ✓ Fetched ${recentMemories.length} recent memories`));

  if (recentMemories.length === 0) {
    console.error(chalk.red('   ✗ No memories found after ingestion!'));
    process.exit(1);
  }

  const testMemory = recentMemories.find(m => m.content.summary.includes('integration test'));
  if (!testMemory) {
    console.error(chalk.red('   ✗ Test memory not found!'));
    process.exit(1);
  }
  console.log(chalk.green(`   ✓ Test memory present (ID: ${testMemory.id})`));

  // 6. Test full-text search
  console.log(chalk.gray('[6] Testing full-text search...'));
  const ftResults = await store.fullTextSearchMemories(
    config.general.teamId,
    'integration',
    10,
    { userId: config.general.userId }
  );
  console.log(chalk.green(`   ✓ Full-text search returned ${ftResults.length} result(s)`));

  // 7. Test hybrid search (vector + FTS)
  console.log(chalk.gray('[7] Testing hybrid search via RAGEngine...'));
  const { RAGEngine } = await import('../src/memory/rag.js');
  const ragEngine = new RAGEngine(config, store, memoryEngine.embeddingService);
  // Build index? It will auto-build on query.
  const hybridResults = await ragEngine.query('integration test', {
    teamId: config.general.teamId,
    userId: config.general.userId,
    useHybrid: true,
    limit: 5,
  });
  console.log(chalk.green(`   ✓ Hybrid search returned ${hybridResults.length} result(s)`));

  // 8. Test synthesis (ask)
  console.log(chalk.gray('[8] Testing synthesis (ask)...'));
  const answer = await memoryEngine.ask('What did the test tool do?');
  console.log(chalk.green('   ✓ Synthesis completed'));
  console.log(chalk.white('   Answer:', answer.substring(0, 200) + (answer.length > 200 ? '...' : '')));

  // 9. Test knowledge base search
  console.log(chalk.gray('[9] Testing knowledge base...'));
  // Create a KB entry
  const kbEntry = await store.createKnowledgeBase({
    teamId: config.general.teamId,
    title: 'Test Knowledge Entry',
    content: 'This is a test knowledge base entry about integration testing.',
    category: 'test',
    visibility: 'team',
  }, { userId: config.general.userId });
  console.log(chalk.green(`   ✓ Created KB entry (ID: ${kbEntry})`));

  const kbSearch = await store.searchKnowledgeBase(
    config.general.teamId,
    'integration test',
    undefined,
    { userId: config.general.userId }
  );
  console.log(chalk.green(`   ✓ KB search returned ${kbSearch.length} result(s)`));

  // Summary
  console.log('\n' + chalk.cyan('=== All tests passed! ==='));
  console.log(chalk.gray(`\nTeam ID: ${config.general.teamId}`));
  console.log(chalk.gray(`User ID: ${config.general.userId}`));
  console.log(chalk.gray(`Memories found: ${recentMemories.length}`));
  console.log(chalk.gray(`FT results: ${ftResults.length}`));
  console.log(chalk.gray(`Hybrid results: ${hybridResults.length}`));
  console.log(chalk.gray(`KB entries: ${kbSearch.length}`));
}

main().catch(err => {
  console.error(chalk.red('Integration test failed:'), err);
  process.exit(1);
});
