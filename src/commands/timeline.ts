import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import chalk from 'chalk';
import ora from 'ora';
import { formatDistanceToNow } from 'date-fns';

export function registerTimelineCommand(program: Command): void {
  program
    .command('timeline')
    .description('View chronological timeline of AI activity')
    .option('--project <id>', 'Filter by project')
    .option('--since <period>', 'Show events since (e.g., 2d, 1h)')
    .option('--limit <n>', 'Maximum events', '50')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      initTelemetry();
      const spinner = ora('Loading timeline...').start();
      try {
        const memories = await withSpan('nautalis.command.timeline', { 
          project: opts.project || 'all', 
          limit: parseInt(opts.limit) 
        }, async () => {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          if (!config.general.teamId) {
            throw new Error('Team ID required. Use --team flag or set teamId in config.');
          }

          return await store.listMemories(config.general.teamId, {
            projectId: opts.project,
            limit: parseInt(opts.limit),
            userId: config.general.userId,
          });
        });

        spinner.stop();
        if (memories.length === 0) {
          console.log(chalk.yellow('No memories found'));
          return;
        }

        console.log(chalk.cyan(`\n  Timeline (${memories.length} entries):\n`));

        for (const memory of memories) {
          const icon =
            memory.classification.memoryType === 'decision'
              ? '💡'
              : memory.classification.memoryType === 'lesson'
                ? '📚'
                : memory.classification.memoryType === 'episodic'
                  ? '📝'
                  : '•';

          console.log(chalk.gray(`  ${formatDistanceToNow(memory.createdAt)} ago`));
          console.log(`  ${icon} ${memory.content.summary}`);
          console.log(
            chalk.gray(
              `     ${memory.agentIdentity.agentName} · ${memory.classification.topics.join(', ') || 'general'}`,
            ),
          );
          console.log('');
        }
      } catch (error) {
        spinner.fail(chalk.red(`Timeline failed: ${error}`));
        throw error;
      }
    });
}
