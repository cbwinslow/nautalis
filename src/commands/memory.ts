import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry, createSpan } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerMemoryCommand(program: Command): void {
  const memoryCmd = program.command('memory').description('Manage memories');

  memoryCmd
    .command('list')
    .description('List all memories')
    .option('--type <type>', 'Filter by memory type')
    .option('--project <id>', 'Filter by project')
    .option('--limit <n>', 'Maximum results', '20')
    .action(async (opts) => {
      initTelemetry();
      const span = createSpan('nautalis.command.memory.list', {
        type: opts.type || 'all',
        project: opts.project || 'all',
        limit: parseInt(opts.limit),
      });
      const spinner = ora('Loading memories...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        if (!config.general.teamId) {
          throw new Error('Team ID required. Use --team flag or set teamId in config.');
        }

        const memories = await store.listMemories(config.general.teamId, {
          projectId: opts.project,
          memoryType: opts.type,
          limit: parseInt(opts.limit),
          userId: config.general.userId,
        });

        spinner.stop();
        console.log(chalk.cyan(`\n  Memories (${memories.length}):\n`));

        for (const memory of memories) {
          const importancePercent = Math.round(memory.classification.importance * 100);
          console.log(chalk.bold(`  • ${memory.content.summary}`));
          console.log(
            chalk.gray(
              `    Type: ${memory.classification.memoryType} | Importance: ${importancePercent}%`,
            ),
          );
          console.log('');
        }
        span.end();
      } catch (error) {
        spinner.fail(chalk.red(`Failed: ${error}`));
        span.end(error as Error);
        process.exit(1);
      }
    });

  memoryCmd
    .command('delete')
    .description('Delete a memory')
    .argument('<id>', 'Memory ID')
    .action(async (id) => {
      initTelemetry();
      const span = createSpan('nautalis.command.memory.delete', { memoryId: id });
      const spinner = ora(`Deleting memory ${id}...`).start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        await store.deleteMemory(id, { userId: config.general.userId, teamId: config.general.teamId });
        spinner.succeed(chalk.green('Memory deleted'));
        span.end();
      } catch (error) {
        spinner.fail(chalk.red(`Failed: ${error}`));
        span.end(error as Error);
        process.exit(1);
      }
    });
}
