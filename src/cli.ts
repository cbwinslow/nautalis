#!/usr/bin/env bun
import { Command } from 'commander';
import { registerCommands } from './commands/register.js';
import { shutdownTelemetry } from './telemetry/provider.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const program = new Command();

program
  .name('nautalis')
  .description('🐙 Universal AI Agent Memory & Orchestration Platform')
  .version(pkg.version)
  .helpOption('-h, --help', 'Show help')
  .addHelpText('after', `
Examples:
  $ nautalis init                    Initialize nautalis
  $ nautalis ingest                  Import existing AI sessions
  $ nautalis search "auth design"    Search memories
  $ nautalis ask "what did I decide about auth?"  RAG-powered Q&A
  $ nautalis timeline --since 2d     View recent activity
  $ nautalis status                  Check current state
  $ nautalis hooks install claude    Install Claude Code hooks
  $ nautalis connectors list         List available connectors
  $ nautalis setup                   Interactive setup wizard
`);

registerCommands(program);

// Handle graceful shutdown on signals
process.on('SIGINT', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownTelemetry();
  process.exit(0);
});

// Parse and then shutdown telemetry to flush spans
;(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  await shutdownTelemetry();
})().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
