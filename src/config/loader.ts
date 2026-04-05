import { cosmiconfig } from 'cosmiconfig';
import type { NautalisConfig } from '../types/config.js';
import { defaultConfig } from './defaults.js';
import { merge } from '../utils/merge.js';
import { NautalisConfigSchema } from '../validation/schemas.js';
import { ZodError } from 'zod';
import toml from '@iarna/toml';

let cachedConfig: NautalisConfig | null = null;

export async function loadConfig(overrides?: Partial<NautalisConfig>): Promise<NautalisConfig> {
  if (cachedConfig && !overrides) {
    return cachedConfig;
  }

  // Load from config file using cosmiconfig with TOML support
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
    loaders: {
      '.toml': (path, content) => toml.parse(content),
    },
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

  // Validate config against schema
  try {
    const validated = NautalisConfigSchema.parse(config);
    cachedConfig = validated as NautalisConfig;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration. See errors above.');
    }
    throw error;
  }

  return cachedConfig;
}

function loadEnvConfig(): Partial<NautalisConfig> {
  const config: Partial<NautalisConfig> = {};

  // Deployment mode (local, docker, baremetal)
  if (process.env.NAUTALIS_DEPLOYMENT) {
    config.deployment = process.env.NAUTALIS_DEPLOYMENT as any;
  }

  if (process.env.NAUTALIS_USER_ID) {
    config.general = { ...config.general, userId: process.env.NAUTALIS_USER_ID } as any;
  }
  if (process.env.NAUTALIS_TEAM_ID) {
    config.general = { ...config.general, teamId: process.env.NAUTALIS_TEAM_ID } as any;
  }

  if (process.env.NAUTALIS_DB_DRIVER) {
    config.database = { driver: process.env.NAUTALIS_DB_DRIVER as any } as any;
  }
   if (process.env.DATABASE_URL) {
     config.database = {
       ...config.database,
       postgres: { url: process.env.DATABASE_URL },
     } as any;
   } else if (process.env.PG_DATABASE_NAME || process.env.PG_HOST) {
     // Fallback: construct DATABASE_URL from PG_* variables
     const host = process.env.PG_HOST || 'localhost';
     const port = process.env.PG_PORT || '5432';
     const db = process.env.PG_DATABASE_NAME || 'nautalis';
     const user = process.env.PG_DATABASE_USER || 'nautalis';
     const password = process.env.PG_DATABASE_PASSWORD || '';
     const url = `postgresql://${user}:${password}@${host}:${port}/${db}`;
     config.database = {
       ...config.database,
       postgres: { url },
     } as any;
   }
   if (process.env.NAUTALIS_DB_POSTGRES_URL) {
     config.database = {
       ...config.database,
       postgres: { url: process.env.NAUTALIS_DB_POSTGRES_URL },
     } as any;
   }
  if (process.env.NAUTALIS_SUPABASE_URL) {
    config.database = {
      driver: 'supabase',
      supabase: {
        projectUrl: process.env.NAUTALIS_SUPABASE_URL,
        serviceKey: process.env.NAUTALIS_SUPABASE_SERVICE_KEY || '',
      },
    } as any;
  }

  if (process.env.NAUTALIS_EMBED_PROVIDER) {
    config.embeddings = { ...config.embeddings, provider: process.env.NAUTALIS_EMBED_PROVIDER as any } as any;
  }
  if (process.env.NAUTALIS_EMBED_MODEL) {
    config.embeddings = { ...config.embeddings, model: process.env.NAUTALIS_EMBED_MODEL } as any;
  }
  if (process.env.NAUTALIS_EMBED_OLLAMA_URL) {
    config.embeddings = { ...config.embeddings, ollama: { url: process.env.NAUTALIS_EMBED_OLLAMA_URL } } as any;
  }
  if (process.env.NAUTALIS_EMBED_OPENAI_API_KEY) {
    config.embeddings = { ...config.embeddings, openai: { apiKeyEnv: 'OPENAI_API_KEY' } } as any;
  }
  if (process.env.NAUTALIS_EMBED_COHERE_API_KEY) {
    config.embeddings = { ...config.embeddings, cohere: { apiKeyEnv: 'COHERE_API_KEY' } } as any;
  }
  if (process.env.NAUTALIS_EMBED_CUSTOM_BASE_URL) {
    config.embeddings = {
      ...config.embeddings,
      custom: {
        baseUrl: process.env.NAUTALIS_EMBED_CUSTOM_BASE_URL,
        model: process.env.NAUTALIS_EMBED_CUSTOM_MODEL || config.embeddings?.model || '',
        apiKeyEnv: process.env.NAUTALIS_EMBED_CUSTOM_API_KEY_ENV,
        headers: process.env.NAUTALIS_EMBED_CUSTOM_HEADERS ? JSON.parse(process.env.NAUTALIS_EMBED_CUSTOM_HEADERS) : undefined,
      },
    } as any;
  }

  if (process.env.NAUTALIS_LLM_PROVIDER) {
    config.llm = { ...config.llm, provider: process.env.NAUTALIS_LLM_PROVIDER as any } as any;
  }
  if (process.env.NAUTALIS_LLM_MODEL) {
    config.llm = { ...config.llm, model: process.env.NAUTALIS_LLM_MODEL } as any;
  }
  if (process.env.NAUTALIS_LLM_OLLAMA_URL) {
    config.llm = { ...config.llm, ollama: { url: process.env.NAUTALIS_LLM_OLLAMA_URL } } as any;
  }
  if (process.env.NAUTALIS_LLM_OPENAI_API_KEY) {
    config.llm = { ...config.llm, openai: { apiKeyEnv: 'OPENAI_API_KEY' } } as any;
  }
  if (process.env.NAUTALIS_LLM_ANTHROPIC_API_KEY) {
    config.llm = { ...config.llm, anthropic: { apiKeyEnv: 'ANTHROPIC_API_KEY' } } as any;
  }
  if (process.env.NAUTALIS_LLM_CUSTOM_BASE_URL) {
    config.llm = {
      ...config.llm,
      custom: {
        baseUrl: process.env.NAUTALIS_LLM_CUSTOM_BASE_URL,
        model: process.env.NAUTALIS_LLM_CUSTOM_MODEL || config.llm?.model || '',
        apiKeyEnv: process.env.NAUTALIS_LLM_CUSTOM_API_KEY_ENV,
        headers: process.env.NAUTALIS_LLM_CUSTOM_HEADERS ? JSON.parse(process.env.NAUTALIS_LLM_CUSTOM_HEADERS) : undefined,
      },
    } as any;
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
