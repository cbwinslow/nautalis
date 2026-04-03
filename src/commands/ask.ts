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
        const results = await memoryEngine.query(question, {
          projectId: opts.project,
          limit: 10,
        });
        
        // TODO: Use LlamaIndex synthesizer for natural language answer
        // For now, return formatted results
        spinner.stop();
        
        if (results.length === 0) {
          console.log(chalk.yellow('No relevant memories found to answer your question.'));
          return;
        }
        
        console.log(chalk.cyan(`\n  Based on your AI agent history:\n`));
        
        for (const result of results) {
          const memory = result.memory;
          console.log(chalk.bold(`  • ${memory.content.summary}`));
          if (memory.content.detail) {
            console.log(chalk.gray(`    ${memory.content.detail}`));
          }
          console.log(chalk.gray(`    — from ${memory.agentIdentity.toolName}`));
          console.log('');
        }
        
        console.log(chalk.gray(`  Found ${results.length} relevant memories`));
      } catch (error) {
        spinner.fail(chalk.red(`Query failed: ${error}`));
        process.exit(1);
      }
    });
}
