import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { initStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import { connectorRegistry, setupConnectors } from '../connectors/registry.js';
import {
  ClaudeCodeConnector,
  KiloCodeConnector,
  FileSystemConnector,
} from '../connectors/index.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize nautalis — set up database, connectors, and configuration')
    .option('--driver <driver>', 'Database driver (postgres, supabase)', 'postgres')
    .option('--team', 'Enable team mode')
    .option('--no-telemetry', 'Disable OpenTelemetry')
    .action(async (opts) => {
      const spinner = ora('Initializing nautalis...').start();

      try {
        // Initialize telemetry first if enabled
        if (opts.telemetry) {
          initTelemetry();
        }

        await withSpan('nautalis.command.init', { driver: opts.driver, teamMode: opts.team }, async () => {
          // Register connectors
          connectorRegistry.register(new ClaudeCodeConnector());
          connectorRegistry.register(new KiloCodeConnector());
          connectorRegistry.register(new FileSystemConnector());

          // Load config with overrides
          const config = await loadConfig({
            database: {
              driver: opts.driver as any,
              postgres: {
                url:
                  process.env.DATABASE_URL ||
                  'postgresql://nautalis:nautalis@localhost:5432/nautalis',
              },
            },
            general: {
              userId: process.env.USER || 'anonymous',
              teamId: opts.team ? 'default' : undefined,
            },
          });

          // Initialize database
          spinner.text = 'Setting up database...';
          const store = await initStore(config);
          await store.init();

          // Setup connectors
          spinner.text = 'Setting up connectors...';
          await setupConnectors(config);

          spinner.succeed(chalk.green('Nautalis initialized successfully!'));
          console.log('');
          console.log(chalk.cyan('  Next steps:'));
          console.log(
            chalk.gray('  • Run ') +
              chalk.white('nautalis status') +
              chalk.gray(' to see current state'),
          );
          console.log(
            chalk.gray('  • Run ') +
              chalk.white('nautalis ingest') +
              chalk.gray(' to import existing sessions'),
          );
          console.log(
            chalk.gray('  • Run ') +
              chalk.white('nautalis search <query>') +
              chalk.gray(' to search memories'),
          );
          console.log(
            chalk.gray('  • Run ') +
              chalk.white('nautalis ask <question>') +
              chalk.gray(' for AI-powered queries'),
          );
          console.log('');
        });
      } catch (error) {
        spinner.fail(chalk.red(`Initialization failed: ${error}`));
        throw error;
      }
    });
}
