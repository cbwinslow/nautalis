import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
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
      const spinner = ora('Loading timeline...').start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();
        
        const memories = await store.listMemories({
          projectId: opts.project,
          limit: parseInt(opts.limit),
        });
        
        spinner.stop();
        
        if (memories.length === 0) {
          console.log(chalk.yellow('No memories found'));
          return;
        }
        
        console.log(chalk.cyan(`\n  Timeline (${memories.length} entries):\n`));
        
        for (const memory of memories) {
          const icon = memory.classification.memoryType === 'decision' ? '💡' :
                       memory.classification.memoryType === 'error' ? '❌' :
                       memory.classification.memoryType === 'lesson' ? '📚' : '📝';
          
          console.log(chalk.gray(`  ${formatDistanceToNow(memory.createdAt)} ago`));
          console.log(`  ${icon} ${memory.content.summary}`);
          console.log(chalk.gray(`     ${memory.agentIdentity.toolName} · ${memory.classification.topics.join(', ') || 'general'}`));
          console.log('');
        }
      } catch (error) {
        spinner.fail(chalk.red(`Timeline failed: ${error}`));
        process.exit(1);
      }
    });
}
