import { Command } from 'commander';
import { connectorRegistry, setupConnectors } from '../connectors/registry.js';
import { ClaudeCodeConnector, KiloCodeConnector, FileSystemConnector } from '../connectors/index.js';
import { loadConfig } from '../config/loader.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerConnectorsCommand(program: Command): void {
  const connectorsCmd = program
    .command('connectors')
    .description('Manage AI agent connectors');
  
  connectorsCmd
    .command('list')
    .description('List available connectors')
    .action(async () => {
      // Register all connectors
      connectorRegistry.register(new ClaudeCodeConnector());
      connectorRegistry.register(new KiloCodeConnector());
      connectorRegistry.register(new FileSystemConnector());
      
      console.log(chalk.cyan('\n  Available connectors:\n'));
      
      for (const [name, connector] of connectorRegistry.getAll()) {
        const status = '⚪ Not configured';
        console.log(chalk.bold(`  • ${name}`));
        console.log(chalk.gray(`    ${connector.metadata.description}`));
        console.log(chalk.gray(`    Version: ${connector.metadata.version}`));
        console.log(chalk.gray(`    Status: ${status}`));
        console.log('');
      }
    });
  
  connectorsCmd
    .command('health')
    .description('Check connector health')
    .action(async () => {
      const spinner = ora('Checking connector health...').start();
      
      try {
        const config = await loadConfig();
        
        connectorRegistry.register(new ClaudeCodeConnector());
        connectorRegistry.register(new KiloCodeConnector());
        connectorRegistry.register(new FileSystemConnector());
        
        await setupConnectors(config);
        
        for (const [name, connector] of connectorRegistry.getAll()) {
          const health = await connector.health();
          const icon = health.status === 'healthy' ? '🟢' : health.status === 'degraded' ? '🟡' : '🔴';
          console.log(`${icon} ${name}: ${health.status}`);
        }
        
        spinner.stop();
      } catch (error) {
        spinner.fail(chalk.red(`Health check failed: ${error}`));
        process.exit(1);
      }
    });
}
