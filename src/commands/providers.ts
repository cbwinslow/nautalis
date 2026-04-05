import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { ProviderRegistry } from '../providers/registry.js';
import { logMessage } from '../telemetry/api.js';

export function registerProvidersCommand(program: Command) {
  program
    .command('providers')
    .description('Manage provider configurations for embeddings and LLM')
    .addCommand(createListCommand());
}

function createListCommand(): Command {
  return new Command('list')
    .description('List all configured providers and their status')
    .action(async () => {
      try {
        const config = await loadConfig();
        const registry = new ProviderRegistry(config.providers);

        console.log('Configured Providers:');
        console.log('-------------------');
        if (!config.providers || Object.keys(config.providers).length === 0) {
          console.log('No providers configured. Add providers under "providers" in config file.');
          return;
        }

        for (const [name, providerConfig] of Object.entries(config.providers)) {
          const hasProvider = registry.hasProvider(name);
          const status = hasProvider ? '✅ Available' : '❌ Unavailable';
          console.log(`Name: ${name}`);
          console.log(`  Type: ${providerConfig.type}`);
          console.log(`  Model: ${providerConfig.model || '(default)'}`);
          if (providerConfig.baseUrl) {
            console.log(`  Base URL: ${providerConfig.baseUrl}`);
          }
          console.log(`  Status: ${status}`);
          console.log();
        }
      } catch (error) {
        logMessage('error', `Failed to list providers: ${error}`);
        console.error('Error:', error);
        process.exit(1);
      }
    });
}
