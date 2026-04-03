import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerMemoryCommand(program: Command): void {
  const memoryCmd = program
    .command('memory')
    .description('Manage memories');
  
  memoryCmd
    .command('list')
    .description('List all memories')
    .option('--type <type>', 'Filter by memory type')
    .option('--project <id>', 'Filter by project')
    .option('--limit <n>', 'Maximum results', '20')
    .action(async (opts) => {
      const spinner = ora('Loading memories...').start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();
        
        const memories = await store.listMemories({
          projectId: opts.project,
          memoryType: opts.type,
          limit: parseInt(opts.limit),
        });
        
        spinner.stop();
        console.log(chalk.cyan(`\n  Memories (${memories.length}):\n`));
        
        for (const memory of memories) {
          console.log(chalk.bold(`  • ${memory.content.summary}`));
          console.log(chalk.gray(`    Type: ${memory.classification.memoryType} | Importance: ${(memory.classification.importance * 100).toFixed(0)}%`));
          console.log('');
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed: ${error}`));
        process.exit(1);
      }
    });
  
  memoryCmd
    .command('delete')
    .description('Delete a memory')
    .argument('<id>', 'Memory ID')
    .action(async (id) => {
      const spinner = ora(`Deleting memory ${id}...`).start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();
        
        await store.deleteMemory(id);
        spinner.succeed(chalk.green('Memory deleted'));
      } catch (error) {
        spinner.fail(chalk.red(`Failed: ${error}`));
        process.exit(1);
      }
    });
}
