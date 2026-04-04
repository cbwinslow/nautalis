import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { MemoryEngine } from '../memory/engine.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerAskCommand(program: Command): void {
  program
    .command('ask')
    .description('Ask a natural language question (RAG-powered)')
    .argument('<question>', 'Your question')
    .option('--project <id>', 'Filter by project')
    .option('--json', 'Output as JSON')
    .action(async (question, opts) => {
      const spinner = ora(`Thinking about "${question}"...`).start();

      try {
        initTelemetry();
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

         const memoryEngine = new MemoryEngine(store, config);
         const answer = await memoryEngine.ask(question, {
           projectId: opts.project,
           limit: 10,
           teamId: config.general.teamId,
           userId: config.general.userId,
         });

        spinner.stop();

        console.log(chalk.cyan(`\n  Answer:\n`));
        console.log(chalk.white(`  ${answer}\n`));
      } catch (error) {
        spinner.fail(chalk.red(`Query failed: ${error}`));
        process.exit(1);
      }
    });
}
