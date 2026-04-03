import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { MemoryEngine } from '../memory/engine.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';
import { formatDistanceToNow } from 'date-fns';

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search memories across all AI agents')
    .argument('<query>', 'Search query')
    .option('--project <id>', 'Filter by project')
    .option('--type <type>', 'Filter by memory type')
    .option('--limit <n>', 'Maximum results', '20')
    .option('--json', 'Output as JSON')
    .action(async (query, opts) => {
      const spinner = ora(`Searching for "${query}"...`).start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();
        
        const memoryEngine = new MemoryEngine(store, config);
        const results = await memoryEngine.query(query, {
          projectId: opts.project,
          limit: parseInt(opts.limit),
        });
        
        spinner.stop();
        
        if (opts.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        
        if (results.length === 0) {
          console.log(chalk.yellow('No results found'));
          return;
        }
        
        console.log(chalk.cyan(`\n  Found ${results.length} results for "${query}":\n`));
        
        for (const result of results) {
          const memory = result.memory;
          console.log(chalk.bold(`  ┌─ ${memory.content.summary}`));
          console.log(chalk.gray(`  │ Type: ${memory.classification.memoryType}`));
          console.log(chalk.gray(`  │ Agent: ${memory.agentIdentity.toolName}`));
          console.log(chalk.gray(`  │ Topics: ${memory.classification.topics.join(', ') || 'N/A'}`));
          console.log(chalk.gray(`  │ Files: ${memory.content.filesInvolved.join(', ') || 'N/A'}`));
          console.log(chalk.gray(`  │ ${formatDistanceToNow(memory.createdAt)} ago`));
          console.log(chalk.bold(`  └─\n`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Search failed: ${error}`));
        process.exit(1);
      }
    });
}
