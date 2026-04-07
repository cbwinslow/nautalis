import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { ProviderRegistry } from '../providers/registry.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import { logMessage } from '../telemetry/api.js';
import chalk from 'chalk';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function saveConfig(config: any): Promise<void> {
  const configPath = join(process.cwd(), '.nautalisrc.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

export function registerProvidersCommand(program: Command) {
  const providersCmd = program.command('providers').description('Manage provider configurations for embeddings and LLM');

  providersCmd.addCommand(createListCommand());
  providersCmd.addCommand(createAddCommand());
  providersCmd.addCommand(createRemoveCommand());
  providersCmd.addCommand(createSetEmbeddingsCommand());
  providersCmd.addCommand(createSetLLMCommand());
}

function createListCommand(): Command {
  return new Command('list')
    .description('List all configured providers and their status')
    .action(async () => {
      await withSpan('nautalis.command.providers.list', {}, async () => {
        try {
          const config: any = await loadConfig();
          const registry = new ProviderRegistry(config.providers);

          console.log('Configured Providers:');
          console.log('-------------------');
          if (!config.providers || Object.keys(config.providers).length === 0) {
            console.log('No providers configured. Add providers under "providers" in config file.');
            return;
          }

          const providers = config.providers as any;
          for (const name in providers) {
            if (Object.prototype.hasOwnProperty.call(providers, name)) {
              const providerConfig = providers[name];
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
          }
        } catch (error) {
          logMessage('error', `Failed to list providers: ${error}`);
          console.error('Error:', error);
          process.exit(1);
        }
      });
    });
}

function createAddCommand(): Command {
  return new Command('add <name> <type>')
    .description('Add a new provider (ollama, openai, anthropic, cohere, custom)')
    .option('--url <url>', 'Base URL for the provider')
    .option('--model <model>', 'Model name')
    .option('--api-key-env <envVar>', 'Environment variable name for API key')
    .action(async (name: string, type: string, options: { url?: string; model?: string; 'api-key-env'?: string }) => {
      await withSpan('nautalis.command.providers.add', { name, type }, async () => {
        const config: any = await loadConfig();
        if (!config.providers) config.providers = {};

        if (config.providers[name]) {
          console.log(chalk.yellow(`Provider "${name}" already exists. Use providers update to modify.`));
          return;
        }

        const providerConfig: any = { type: type.toLowerCase() };
        if (options.url) providerConfig.baseUrl = options.url;
        if (options.model) providerConfig.model = options.model;
        if (options['api-key-env']) providerConfig.apiKeyEnv = options['api-key-env'];

        // Type-specific defaults
        if (type === 'ollama' && !providerConfig.baseUrl) {
          providerConfig.baseUrl = 'http://localhost:11434';
        }
        if (type === 'ollama' && !providerConfig.model) {
          providerConfig.model = 'nomic-embed-text'; // default embedding model
        }
        if (type === 'openai' && !providerConfig.apiKeyEnv) {
          providerConfig.apiKeyEnv = 'OPENAI_API_KEY';
        }
        if (type === 'anthropic' && !providerConfig.apiKeyEnv) {
          providerConfig.apiKeyEnv = 'ANTHROPIC_API_KEY';
        }
        if (type === 'cohere' && !providerConfig.apiKeyEnv) {
          providerConfig.apiKeyEnv = 'COHERE_API_KEY';
        }

        config.providers[name] = providerConfig;
        await saveConfig(config);
        console.log(chalk.green(`Provider "${name}" added successfully.`));
        console.log(chalk.gray(`  Type: ${providerConfig.type}`));
        if (providerConfig.baseUrl) console.log(chalk.gray(`  URL: ${providerConfig.baseUrl}`));
        if (providerConfig.model) console.log(chalk.gray(`  Model: ${providerConfig.model}`));
      });
    });
}

function createRemoveCommand(): Command {
  return new Command('remove <name>')
    .description('Remove a provider from configuration')
    .action(async (name: string) => {
      await withSpan('nautalis.command.providers.remove', { name }, async () => {
        const config: any = await loadConfig();
        if (!config.providers || !config.providers[name]) {
          console.log(chalk.yellow(`Provider "${name}" does not exist.`));
          return;
        }
        delete config.providers![name];
        await saveConfig(config);
        console.log(chalk.green(`Provider "${name}" removed.`));
      });
    });
}

function createSetEmbeddingsCommand(): Command {
  return new Command('set-embeddings <providerName>')
    .description('Set the default embeddings provider')
    .action(async (providerName: string) => {
      await withSpan('nautalis.command.providers.setEmbeddings', { provider: providerName }, async () => {
        const config: any = await loadConfig();
        if (config.providers && config.providers[providerName]) {
          config.embeddings = {
            provider: providerName,
            model: config.providers[providerName].model || config.embeddings?.model || 'nomic-embed-text',
          };
          // Also copy provider-specific config if needed (url, apiKeyEnv)
          if (config.providers[providerName].baseUrl) {
            const pType = config.providers[providerName].type;
            if (!config.embeddings[pType]) config.embeddings[pType] = {};
            config.embeddings[pType].url = config.providers[providerName].baseUrl;
          }
          if (config.providers[providerName].apiKeyEnv) {
            const pType = config.providers[providerName].type;
            if (!config.embeddings[pType]) config.embeddings[pType] = {};
            config.embeddings[pType].apiKeyEnv = config.providers[providerName].apiKeyEnv;
          }
        } else {
          // Direct provider type (ollama, openai, etc.) without named provider
          config.embeddings = { provider: providerName, model: '' };
        }
        await saveConfig(config);
        console.log(chalk.green(`Embeddings provider set to "${providerName}".`));
      });
    });
}

function createSetLLMCommand(): Command {
  return new Command('set-llm <providerName>')
    .description('Set the default LLM provider')
    .action(async (providerName: string) => {
      await withSpan('nautalis.command.providers.setLLM', { provider: providerName }, async () => {
        const config: any = await loadConfig();
        if (config.providers && config.providers[providerName]) {
          config.llm = {
            provider: providerName,
            model: config.providers[providerName].model || config.llm?.model || 'qwen2.5:3b',
          };
          if (config.providers[providerName].baseUrl) {
            const pType = config.providers[providerName].type;
            if (!config.llm[pType]) config.llm[pType] = {};
            config.llm[pType].url = config.providers[providerName].baseUrl;
          }
          if (config.providers[providerName].apiKeyEnv) {
            const pType = config.providers[providerName].type;
            if (!config.llm[pType]) config.llm[pType] = {};
            config.llm[pType].apiKeyEnv = config.providers[providerName].apiKeyEnv;
          }
        } else {
          config.llm = { provider: providerName, model: '' };
        }
        await saveConfig(config);
        console.log(chalk.green(`LLM provider set to "${providerName}".`));
      });
    });
}
