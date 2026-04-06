#!/usr/bin/env bun
/**
 * Performance benchmark for Nautalis search operations.
 * Measures latency of vector search, full-text search, and hybrid search.
 *
 * Usage: bun run scripts/benchmark-search.ts [--iterations N] [--setup]
 *   --setup: create fresh test team/user/data (ommitting uses existing if configured)
 */

import { loadConfig } from '../src/config/loader.js';
import { getStore } from '../src/store/factory.js';
import { MemoryEngine } from '../src/memory/engine.js';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

interface Stats {
  min: number;
  max: number;
  sum: number;
  count: number;
  values: number[];
}

function addStat(s: Stats, value: number) {
  s.values.push(value);
  s.min = Math.min(s.min, value);
  s.max = Math.max(s.max, value);
  s.sum += value;
  s.count++;
}

function percentiles(s: Stats): { p50: number; p95: number; p99: number } {
  const sorted = [...s.values].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { p50, p95, p99 };
}

async function ensureTestData(store: any, config: any) {
  console.log(chalk.gray('Creating test user, team, and memories...'));

  // Create user (store will generate ID)
  const user = await store.createUser({
    email: `benchmark-${Date.now()}@example.com`,
    name: 'Benchmark User',
  });
  const userId = user.id;
  config.general.userId = userId;
  console.log(chalk.green(`   ✓ User created: ${userId}`));

  // Create team with user as owner
  const team = await store.createTeam({
    name: 'Benchmark Team',
    slug: `benchmark-${Date.now()}`,
    ownerId: userId,
  });
  const teamId = team.id;
  config.general.teamId = teamId;
  console.log(chalk.green(`   ✓ Team created: ${teamId}`));

  // Insert test memories (10)
  console.log(chalk.gray('Inserting 10 test memories...'));
  for (let i = 0; i < 10; i++) {
    const embedding = new Array(768).fill(0).map(() => Math.random());

    const memory = {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      agentIdentity: {
        toolName: 'benchmark',
        toolVersion: '1.0',
        instanceId: 'bench-' + uuidv4().slice(0, 8),
        sessionId: '',
        agentName: 'Benchmark',
        userId: userId,
      },
      context: {
        teamId,
        projectId: '',
        repoPath: '',
        repoUrl: undefined,
        branch: undefined,
        cwd: '',
        platform: 'linux',
      },
      classification: {
        memoryType: 'episodic',
        blockLabel: undefined,
        topics: ['test'],
        importance: 0.5,
        confidence: 0.8,
        sensitivity: 'internal',
      },
      content: {
        summary: `Benchmark test memory ${i}`,
        detail: undefined,
        filesInvolved: [],
        commandsExec: [],
        errorsSeen: [],
        codeSnippets: [],
      },
      relationships: {
        parentMemoryId: undefined,
        supersedes: [],
        contradicts: [],
        supports: [],
        tags: [],
      },
      lifecycle: {
        ttl: undefined,
        decayRate: 0.01,
        lastAccess: new Date(),
        accessCount: 0,
        isStale: false,
      },
      embedding,
    };

    await store.insertMemory(memory);
  }
  console.log(chalk.green(`   ✓ Inserted 10 test memories`));
}

async function main() {
  const args = process.argv.slice(2);
  const iterations = args.includes('--iterations') ? parseInt(args[args.indexOf('--iterations') + 1]) : 100;
  const doSetup = args.includes('--setup');

  console.log(chalk.cyan('=== Nautalis Performance Benchmark ===\n'));

  const config = await loadConfig();
  const store = await getStore(config);
  await store.init();

  // If --setup, create fresh data and use those IDs; otherwise use config or fail
  if (doSetup) {
    await ensureTestData(store, config);
  }

  const teamId = config.general.teamId;
  const userId = config.general.userId;

  if (!teamId || !userId) {
    console.error(chalk.red('teamId and userId are required. Run with --setup to create test data, or set them in config.'));
    process.exit(1);
  }

  console.log(chalk.gray(`Config: teamId=${teamId}, userId=${userId}`));
  console.log(chalk.gray(`Iterations: ${iterations}\n`));

  // Prepare query embedding
  console.log(chalk.gray('Generating query embedding...'));
  const memoryEngine = new MemoryEngine(store, config);
  const sampleQuery = 'performance benchmark test';
  const embedResult = await memoryEngine.embeddingService.embed(sampleQuery);
  const queryEmbedding = embedResult.embedding;
  console.log(chalk.green(`   ✓ Embedding generated (${queryEmbedding.length} dim)\n`));

  // Stats
  const vectorStats: Stats = { min: Infinity, max: 0, sum: 0, count: 0, values: [] };
  const ftsStats: Stats = { min: Infinity, max: 0, sum: 0, count: 0, values: [] };
  const hybridStats: Stats = { min: Infinity, max: 0, sum: 0, count: 0, values: [] };

  // Warm-up
  console.log(chalk.gray('Warm-up run...'));
  try {
    await store.findSimilarMemories(queryEmbedding, teamId, 10, undefined, { userId });
    await store.fullTextSearchMemories(teamId, sampleQuery, 10, { userId });
    await memoryEngine.query(sampleQuery, { teamId, userId, useHybrid: true, limit: 5 });
    console.log(chalk.green('   ✓ Warm-up complete\n'));
  } catch (err) {
    console.error(chalk.red('Warm-up failed. Ensure permissions and data exist.'), err);
    process.exit(1);
  }

  // Benchmark loop
  console.log(chalk.cyan(`Running ${iterations} iterations...`));
  for (let i = 0; i < iterations; i++) {
    // Vector search
    const start = Date.now();
    await store.findSimilarMemories(queryEmbedding, teamId, 10, undefined, { userId });
    const duration = Date.now() - start;
    addStat(vectorStats, duration);

    // Full-text search
    const startFts = Date.now();
    await store.fullTextSearchMemories(teamId, sampleQuery, 10, { userId });
    const durationFts = Date.now() - startFts;
    addStat(ftsStats, durationFts);

    // Hybrid search
    const startHybrid = Date.now();
    await memoryEngine.query(sampleQuery, { teamId, userId, useHybrid: true, limit: 5 });
    const durationHybrid = Date.now() - startHybrid;
    addStat(hybridStats, durationHybrid);
  }

  // Compute stats
  const { p50: v50, p95: v95, p99: v99 } = percentiles(vectorStats);
  const { p50: f50, p95: f95, p99: f99 } = percentiles(ftsStats);
  const { p50: h50, p95: h95, p99: h99 } = percentiles(hybridStats);

  console.log('\n' + chalk.bold('Results:'));
  console.log(chalk.cyan('Vector Search (pure pgvector):'));
  console.log(`  Count: ${vectorStats.count}`);
  console.log(`  Avg:  ${(vectorStats.sum / vectorStats.count).toFixed(2)} ms`);
  console.log(`  Min:  ${vectorStats.min} ms`);
  console.log(`  Max:  ${vectorStats.max} ms`);
  console.log(`  p50:  ${v50} ms`);
  console.log(`  p95:  ${v95} ms`);
  console.log(`  p99:  ${v99} ms`);

  console.log(chalk.cyan('Full-Text Search (tsvector):'));
  console.log(`  Count: ${ftsStats.count}`);
  console.log(`  Avg:  ${(ftsStats.sum / ftsStats.count).toFixed(2)} ms`);
  console.log(`  Min:  ${ftsStats.min} ms`);
  console.log(`  Max:  ${ftsStats.max} ms`);
  console.log(`  p50:  ${f50} ms`);
  console.log(`  p95:  ${f95} ms`);
  console.log(`  p99:  ${f99} ms`);

  console.log(chalk.cyan('Hybrid Search (vector + FTS + merge):'));
  console.log(`  Count: ${hybridStats.count}`);
  console.log(`  Avg:  ${(hybridStats.sum / hybridStats.count).toFixed(2)} ms`);
  console.log(`  Min:  ${hybridStats.min} ms`);
  console.log(`  Max:  ${hybridStats.max} ms`);
  console.log(`  p50:  ${h50} ms`);
  console.log(`  p95:  ${h95} ms`);
  console.log(`  p99:  ${h99} ms`);

  console.log('\n' + chalk.gray('Benchmark complete.'));

  // Performance target check
  const targetMs = 500;
  if (v95 <= targetMs && f95 <= targetMs && h95 <= targetMs) {
    console.log(chalk.green(`✅ All search methods meet p95 <${targetMs}ms target!`));
  } else {
    console.log(chalk.yellow(`⚠️  Performance target (p95 <${targetMs}ms) not fully met.`));
  }
}

main().catch(err => {
  console.error(chalk.red('Benchmark failed:'), err);
  process.exit(1);
});
