import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard')
    .action(async () => {
      initTelemetry();
      const rl = createInterface({ input: stdin, output: stdout });

      try {
        await withSpan('nautalis.command.setup', {}, async () => {
          console.log(chalk.cyan('\n  🐙 Nautalis Setup Wizard\n'));
          console.log(chalk.gray('  This wizard will create a configuration file.\n'));

          const config: any = {
            general: {
              user_id: '',
              team_id: '',
            },
            database: {
              driver: 'postgres',
              postgres: {
                url: '',
                max_connections: 20,
              },
            },
            embeddings: {
              provider: 'ollama',
              model: 'nomic-embed-text',
            },
            llm: {
              provider: 'ollama',
              model: 'qwen2.5:3b',
            },
            connectors: [],
            guardrails: {
              pii_detection: true,
              secret_detection: true,
              max_context_lines: 100,
              min_relevance_score: 0.7,
            },
          };

          // Database URL
          const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://nautalis:nautalis@localhost:5432/nautalis';
          const dbUrl = await rl.question(`  Database URL [${defaultDbUrl}]: `);
          config.database.postgres.url = dbUrl || defaultDbUrl;

          // User ID
          const defaultUser = process.env.USER || process.env.USERNAME || 'user';
          const userId = await rl.question(`  User ID [${defaultUser}]: `);
          config.general.user_id = userId || defaultUser;

          // Team ID (optional)
          const teamId = await rl.question(`  Team ID (optional, press Enter to skip): `);
          if (teamId) config.general.team_id = teamId;

          // Embeddings provider
          console.log(chalk.cyan('\n  Embeddings Configuration'));
          const embedProvider = await rl.question(`  Provider (ollama, openai, cohere, custom) [ollama]: `);
          config.embeddings.provider = embedProvider.toLowerCase() || 'ollama';
          if (config.embeddings.provider === 'ollama') {
            const ollamaUrl = await rl.question(`  Ollama URL [http://localhost:11434]: `);
            config.embeddings.ollama = { url: ollamaUrl || 'http://localhost:11434' };
          } else if (['openai', 'cohere'].includes(config.embeddings.provider)) {
            const apiKeyEnv = await rl.question(`  API key environment variable name [${config.embeddings.provider.toUpperCase()}_API_KEY]: `);
            config.embeddings[config.embeddings.provider] = {
              apiKeyEnv: apiKeyEnv || `${config.embeddings.provider.toUpperCase()}_API_KEY`,
              model: await rl.question(`  Model name (default for ${config.embeddings.provider}): `) || (config.embeddings.provider === 'openai' ? 'text-embedding-3-small' : ''),
            };
          } else if (config.embeddings.provider === 'custom') {
            const baseUrl = await rl.question(`  Custom base URL: `);
            const model = await rl.question(`  Model name: `);
            config.embeddings.custom = { baseUrl, model };
          }

          // LLM provider
          console.log(chalk.cyan('\n  LLM Configuration'));
          const llmProvider = await rl.question(`  Provider (ollama, openai, anthropic, custom) [ollama]: `);
          config.llm.provider = llmProvider.toLowerCase() || 'ollama';
          if (config.llm.provider === 'ollama') {
            const ollamaUrl = await rl.question(`  Ollama URL [http://localhost:11434]: `);
            config.llm.ollama = { url: ollamaUrl || 'http://localhost:11434' };
            const model = await rl.question(`  Model name [qwen2.5:3b]: `);
            if (model) config.llm.model = model;
          } else if (config.llm.provider === 'openai') {
            const apiKeyEnv = await rl.question(`  API key environment variable name [OPENAI_API_KEY]: `);
            config.llm.openai = { apiKeyEnv: apiKeyEnv || 'OPENAI_API_KEY' };
            const model = await rl.question(`  Model name [gpt-4-turbo]: `);
            if (model) config.llm.model = model;
          } else if (config.llm.provider === 'anthropic') {
            const apiKeyEnv = await rl.question(`  API key environment variable name [ANTHROPIC_API_KEY]: `);
            config.llm.anthropic = { apiKeyEnv: apiKeyEnv || 'ANTHROPIC_API_KEY' };
            const model = await rl.question(`  Model name [claude-3-5-sonnet-latest]: `);
            if (model) config.llm.model = model;
          } else if (config.llm.provider === 'custom') {
            const baseUrl = await rl.question(`  Custom base URL: `);
            const model = await rl.question(`  Model name: `);
            config.llm.custom = { baseUrl, model };
          }

          // Connectors
          console.log(chalk.cyan('\n  Connector Configuration'));
          const enableClaude = await rl.question(`  Enable Claude Code connector? (Y/n): `);
          if (enableClaude.toLowerCase() !== 'n') {
            config.connectors.push({
              type: 'claude_code',
              enabled: true,
              source_dirs: ['~/.claude/projects'],
            });
          }
          const enableKilo = await rl.question(`  Enable Kilo Code connector? (Y/n): `);
          if (enableKilo.toLowerCase() !== 'n') {
            config.connectors.push({
              type: 'kilo_code',
              enabled: true,
              source_dirs: ['~/.kilocode/sessions'],
            });
          }
          const enableFS = await rl.question(`  Enable FileSystem watcher? (y/N): `);
          if (enableFS.toLowerCase() === 'y') {
            const watchDir = await rl.question(`  Directory to watch [.]: `) || '.';
            config.connectors.push({
              type: 'filesystem',
              enabled: true,
              source_dirs: [watchDir],
            });
          }

          // Write config
          const configPath = join(process.cwd(), '.nautalisrc.json');
          await writeFile(configPath, JSON.stringify(config, null, 2));
          console.log(chalk.green(`\n  Configuration saved to ${configPath}`));
          console.log(chalk.gray('\n  Next steps:\n'));
          console.log(chalk.white(`    nautalis init`));
          console.log(chalk.gray('    (this will initialize the database and migrate schema)\n'));
        });
      } catch (error) {
        console.error(chalk.red(`Setup failed: ${error}`));
        throw error;
      } finally {
        rl.close();
      }
    });
}
