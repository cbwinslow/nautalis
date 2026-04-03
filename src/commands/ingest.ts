import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { connectorRegistry, setupConnectors } from '../connectors/registry.js';
import { ClaudeCodeConnector, KiloCodeConnector, FileSystemConnector } from '../connectors/index.js';
import { MemoryEngine } from '../memory/engine.js';
import { initTelemetry } from '../telemetry/provider.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerIngestCommand(program: Command): void {
  program
    .command('ingest')
    .description('Ingest events from AI agents into the memory store')
    .argument('[source]', 'Source to ingest from (claude, kilo, all)')
    .option('--async', 'Run asynchronously')
    .option('--connector <name>', 'Specific connector to use')
    .action(async (source, opts) => {
      const spinner = ora('Ingesting events...').start();
      
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
        
        const memoryEngine = new MemoryEngine(store, config);
        
        // Ingest from connectors
        const events = await connectorRegistry.ingestAll(config.connectors);
        
        if (events.length === 0) {
          spinner.info(chalk.yellow('No new events to ingest'));
          return;
        }
        
        spinner.text = `Processing ${events.length} events...`;
        const memoryCount = await memoryEngine.ingestEvents(events);
        
        spinner.succeed(chalk.green(`Ingested ${events.length} events → ${memoryCount} memories`));
      } catch (error) {
        spinner.fail(chalk.red(`Ingestion failed: ${error}`));
        process.exit(1);
      }
    });
}
