import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerInjectCommand(program: Command): void {
  program
    .command('inject')
    .description('Inject context into the current AI agent session')
    .option('--dry-run', 'Show what would be injected without injecting')
    .option('--session <id>', 'Target session ID')
    .action(async (opts) => {
      const spinner = ora('Building context...').start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();
        
        // TODO: Build context from recent memories
        const context = 'Context injection not fully implemented yet';
        
        spinner.stop();
        
        if (opts.dryRun) {
          console.log(chalk.cyan('\n  Would inject:\n'));
          console.log(context);
          console.log('');
          return;
        }
        
        // Output to stdout for hook consumption
        process.stdout.write(JSON.stringify({ context }) + '\n');
      } catch (error) {
        spinner.fail(chalk.red(`Injection failed: ${error}`));
        process.exit(1);
      }
    });
}
