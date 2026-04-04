import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import { formatDistanceToNow } from 'date-fns';
import chalk from 'chalk';
import ora from 'ora';

export function registerInjectCommand(program: Command): void {
  program
    .command('inject')
    .description('Inject context into the current AI agent session')
    .option('--dry-run', 'Show what would be injected without injecting')
    .option('--session <id>', 'Target session ID')
    .option('--limit <n>', 'Maximum memories to include', '10')
    .action(async (opts) => {
      const spinner = ora('Building context from memories...').start();

      try {
        initTelemetry();
        const config = await loadConfig();

        // Team context is required
        if (!config.general.teamId) {
          throw new Error('Team ID required. Set --team flag or configure teamId in config.');
        }

        const store = await getStore(config);
        await store.init();

         // Build context: recent important memories from the team
         const limit = parseInt(opts.limit);
         const memories = await store.listMemories(config.general.teamId, {
           limit,
           userId: config.general.userId,
         });

        spinner.stop();

        if (memories.length === 0) {
          console.log(chalk.yellow('\n  No recent memories found. Starting with a blank slate.\n'));
          return;
        }

        // Format context for agent consumption
        const contextLines: string[] = [];
        contextLines.push('=== Recent Team Activity ===\n');

        for (const memory of memories) {
          const timeAgo = formatDistanceToNow(memory.createdAt, { addSuffix: true });
          const agent = memory.agentIdentity.agentName || memory.agentIdentity.toolName;
          const type = memory.classification.memoryType;
          const summary = memory.content.summary;
          contextLines.push(`[${timeAgo}] ${agent} (${type}): ${summary}`);

          if (memory.content.detail && memory.content.detail.length > 0) {
            const detailPreview =
              memory.content.detail.length > 200
                ? memory.content.detail.substring(0, 200) + '...'
                : memory.content.detail;
            contextLines.push(`  Details: ${detailPreview}\n`);
          } else {
            contextLines.push('');
          }
        }

        contextLines.push('=== End of Context ===');
        const context = contextLines.join('\n');

        if (opts.dryRun) {
          console.log(chalk.cyan('\n  Would inject the following context:\n'));
          console.log(context);
          console.log('');
          console.log(chalk.gray(`  (${memories.length} memories, ${context.length} characters)`));
          return;
        }

        // Output to stdout for hook consumption (to be piped to agent)
        process.stdout.write(context + '\n');
      } catch (error) {
        spinner.fail(chalk.red(`Injection failed: ${error}`));
        process.exit(1);
      }
    });
}
