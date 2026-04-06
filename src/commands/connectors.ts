import { Command } from 'commander';
import { connectorRegistry, setupConnectors, healthConnectors } from '../connectors/registry.js';
import { ClaudeCodeConnector, KiloCodeConnector, FileSystemConnector } from '../connectors/index.js';
import { loadConfig } from '../config/loader.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
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
      initTelemetry();
      await withSpan('nautalis.command.connectors.list', {}, async () => {
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
    });
  
  connectorsCmd
    .command('health')
    .description('Check connector health')
    .action(async () => {
      initTelemetry();
      const spinner = ora('Checking connector health...').start();
      
      try {
        await withSpan('nautalis.command.connectors.health', {}, async () => {
          const config = await loadConfig();
          
          connectorRegistry.register(new ClaudeCodeConnector());
          connectorRegistry.register(new KiloCodeConnector());
          connectorRegistry.register(new FileSystemConnector());
          
          await setupConnectors(config);
          
          const allHealth = await healthConnectors();
          for (const [name, health] of Object.entries(allHealth)) {
            const icon = health.status === 'healthy' ? '🟢' : health.status === 'degraded' ? '🟡' : '🔴';
            console.log(`${icon} ${name}: ${health.status}${health.error ? ` (${health.error})` : ''}`);
          }
          
          spinner.stop();
        });
      } catch (error) {
        spinner.fail(chalk.red(`Health check failed: ${error}`));
        throw error;
      }
    });
}
