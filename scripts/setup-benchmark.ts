#!/usr/bin/env bun
/**
 * Quick setup for benchmarking: creates a team and user, grants permissions.
 */

import { getStore } from './src/store/factory.js';
import { loadConfig } from './src/config/loader.js';
import { v4 as uuidv4 } from 'uuid';

async function setup() {
  const config = await loadConfig();
  const store = await getStore(config);
  await store.init();

  const teamId = uuidv4();
  const userId = uuidv4();

  console.log(`Creating team ${teamId} and user ${userId}...`);

  // Create team (owner)
  await store.createTeam('Benchmark Team', 'Benchmarking', teamId);

  // Add user as owner
  await store.addTeamMember(teamId, userId, 'owner');

  // Set current team context
  await store.withTeamContext(teamId, async () => {
    // Insert a few test memories to ensure there's data
    const testMemory = {
      memoryId: uuidv4(),
      teamId,
      userId,
      projectId: '',
      agentIdentity: { toolName: 'benchmark', sessionId: '', userId },
      type: 'episodic',
      content: { summary: 'Benchmark test memory', detail: '' },
      classification: { memoryType: 'episodic', topics: ['test'], importance: 0.5, sensitivity: 'internal' },
      embedding: new Array(768).fill(0).map(() => Math.random()),
      context: { teamId, projectId: '', repoPath: '', repoUrl: '', branch: '', cwd: '', platform: 'linux' },
      extracted: { decisions: [], errors: [], topics: [] },
      raw: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 0,
      lastAccessedAt: new Date(),
      isStale: false,
    };

    await store.insertMemory(testMemory);
    console.log('Inserted test memory');
  });

  console.log(`\n=== Setup Complete ===`);
  console.log(`teamId: ${teamId}`);
  console.log(`userId: ${userId}`);
  console.log(`\nRun benchmark with:`);
  console.log(`bun run scripts/benchmark-search.ts --teamId ${teamId} --userId ${userId} --iterations 100`);
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
