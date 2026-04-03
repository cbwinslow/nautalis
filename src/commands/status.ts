import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { connectorRegistry, setupConnectors } from '../connectors/registry.js';
import { ClaudeCodeConnector, KiloCodeConnector, FileSystemConnector } from '../connectors/index.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current nautalis status')
    .action(async () => {
      const spinner = ora('Checking status...').start();
      
      try {
        initTelemetry();
        const config = await loadConfig();
        
        // Register connectors
        connectorRegistry.register(new ClaudeCodeConnector());
        connectorRegistry.register(new KiloCodeConnector());
        connectorRegistry.register(new FileSystemConnector());
        
        await setupConnectors(config);
        const store = await getStore(config);
        await store.init();
        
        const stats = await store.getStats();
        
        spinner.stop();
        
        console.log(chalk.cyan('\n  ╔══════════════════════════════════════╗'));
        console.log(chalk.cyan('  ║         Nautalis Status              ║'));
        console.log(chalk.cyan('  ╚══════════════════════════════════════╝'));
        console.log('');
        console.log(chalk.bold('  Configuration:'));
        console.log(chalk.gray(`    User: ${config.general.userId}`));
        console.log(chalk.gray(`    Database: ${config.database.driver}`));
        console.log(chalk.gray(`    Embeddings: ${config.embeddings.provider} (${config.embeddings.model})`));
        console.log(chalk.gray(`    LLM: ${config.llm.provider} (${config.llm.model})`));
        console.log('');
        console.log(chalk.bold('  Statistics:'));
        console.log(chalk.gray(`    Events: ${stats.totalEvents}`));
        console.log(chalk.gray(`    Memories: ${stats.totalMemories}`));
        console.log(chalk.gray(`    Agents: ${stats.totalAgents}`));
        console.log(chalk.gray(`    Projects: ${stats.totalProjects}`));
        console.log(chalk.gray(`    Sessions: ${stats.totalSessions}`));
        console.log('');
      } catch (error) {
        spinner.fail(chalk.red(`Status check failed: ${error}`));
        process.exit(1);
      }
    });
}
