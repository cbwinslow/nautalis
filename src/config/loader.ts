import { cosmiconfig } from 'cosmiconfig';
import type { NautalisConfig, DatabaseDriver, EmbedProvider, LLMProvider } from '../types/config.js';
import { defaultConfig } from './defaults.js';
import { merge } from '../utils/merge.js';
import * as path from 'path';
import * as os from 'os';

let cachedConfig: NautalisConfig | null = null;

export async function loadConfig(overrides?: Partial<NautalisConfig>): Promise<NautalisConfig> {
  if (cachedConfig && !overrides) {
    return cachedConfig;
  }

  // Load from config file using cosmiconfig
  const explorer = cosmiconfig('nautalis', {
    searchPlaces: [
      'package.json',
      '.nautalisrc',
      '.nautalisrc.json',
      '.nautalisrc.yaml',
      '.nautalisrc.yml',
      '.nautalisrc.toml',
      'nautalis.config.js',
      'nautalis.config.mjs',
      'nautalis.config.ts',
    ],
  });

  let fileConfig: Partial<NautalisConfig> = {};
  try {
    const result = await explorer.search();
    if (result) {
      fileConfig = result.config as Partial<NautalisConfig>;
    }
  } catch {
    // No config file found, use defaults
  }

  // Load from environment variables
  const envConfig = loadEnvConfig();

  // Merge: defaults < file < env < overrides
  let config = merge(defaultConfig, fileConfig) as NautalisConfig;
  config = merge(config, envConfig) as NautalisConfig;
  if (overrides) {
    config = merge(config, overrides) as NautalisConfig;
  }

  cachedConfig = config;
  return config;
}

function loadEnvConfig(): Partial<NautalisConfig> {
  const config: Partial<NautalisConfig> = {};

  if (process.env.NAUTALIS_USER_ID) {
    config.general = { ...config.general, userId: process.env.NAUTALIS_USER_ID } as any;
  }
  if (process.env.NAUTALIS_TEAM_ID) {
    config.general = { ...config.general, teamId: process.env.NAUTALIS_TEAM_ID } as any;
  }

  if (process.env.NAUTALIS_DB_DRIVER) {
    config.database = { driver: process.env.NAUTALIS_DB_DRIVER as DatabaseDriver } as any;
  }
  if (process.env.NAUTALIS_DB_SQLITE_PATH) {
    config.database = {
      ...config.database,
      sqlite: { path: process.env.NAUTALIS_DB_SQLITE_PATH.replace(/^~/, os.homedir()) },
    } as any;
  }
  if (process.env.NAUTALIS_DB_POSTGRES_URL) {
    config.database = {
      ...config.database,
      postgres: { url: process.env.NAUTALIS_DB_POSTGRES_URL },
    } as any;
  }

  if (process.env.NAUTALIS_EMBED_PROVIDER) {
    config.embeddings = { provider: process.env.NAUTALIS_EMBED_PROVIDER as EmbedProvider, model: '' } as any;
  }
  if (process.env.NAUTALIS_EMBED_MODEL) {
    config.embeddings = { ...config.embeddings, model: process.env.NAUTALIS_EMBED_MODEL } as any;
  }
  if (process.env.NAUTALIS_EMBED_OLLAMA_URL) {
    config.embeddings = { ...config.embeddings, ollama: { url: process.env.NAUTALIS_EMBED_OLLAMA_URL } } as any;
  }

  if (process.env.NAUTALIS_LLM_PROVIDER) {
    config.llm = { provider: process.env.NAUTALIS_LLM_PROVIDER as LLMProvider, model: '' } as any;
  }
  if (process.env.NAUTALIS_LLM_MODEL) {
    config.llm = { ...config.llm, model: process.env.NAUTALIS_LLM_MODEL } as any;
  }

  return config;
}

export function getConfig(): NautalisConfig {
  if (!cachedConfig) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
