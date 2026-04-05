import { test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig, resetConfig, getConfig } from '../../src/config/loader.js';
import type { NautalisConfig } from '../../src/types/config.js';

// Helper to set/unset env vars
function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  resetConfig();
});

afterEach(() => {
  // Clean up all relevant env vars
  setEnv({
    NAUTALIS_USER_ID: undefined,
    NAUTALIS_TEAM_ID: undefined,
    NAUTALIS_DEPLOYMENT: undefined,
    DATABASE_URL: undefined,
    PG_HOST: undefined,
    PG_PORT: undefined,
    PG_DATABASE_NAME: undefined,
    PG_DATABASE_USER: undefined,
    PG_DATABASE_PASSWORD: undefined,
    NAUTALIS_DB_DRIVER: undefined,
    NAUTALIS_DB_POSTGRES_URL: undefined,
    NAUTALIS_SUPABASE_URL: undefined,
    NAUTALIS_SUPABASE_SERVICE_KEY: undefined,
  });
});

test('loadConfig: uses defaults when no env/file config', async () => {
  const config = await loadConfig();
  expect(config.database.driver).toBe('postgres');
  expect(config.embeddings.provider).toBe('ollama');
  expect(config.llm.provider).toBe('ollama');
  expect(config.deployment).toBe('local');
});

test('loadConfig: overrides with overrides parameter', async () => {
  const config = await loadConfig({
    database: { 
      driver: 'supabase' as any,
      supabase: { projectUrl: 'https://test.supabase.co', serviceKey: 'key' }
    },
  });
  expect(config.database.driver).toBe('supabase');
});

test('loadConfig: NAUTALIS_USER_ID and NAUTALIS_TEAM_ID override defaults', async () => {
  setEnv({ NAUTALIS_USER_ID: 'user-123', NAUTALIS_TEAM_ID: 'team-456' });
  const config = await loadConfig();
  expect(config.general.userId).toBe('user-123');
  expect(config.general.teamId).toBe('team-456');
});

test('loadConfig: DATABASE_URL sets postgres connection', async () => {
  setEnv({ DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb' });
  const config = await loadConfig();
  expect(config.database.driver).toBe('postgres');
  expect(config.database.postgres?.url).toBe('postgresql://test:test@localhost:5432/testdb');
});

test('loadConfig: PG_* variables construct DATABASE_URL when DATABASE_URL not set', async () => {
  setEnv({
    PG_HOST: 'db.example.com',
    PG_PORT: '5433',
    PG_DATABASE_NAME: 'mydb',
    PG_DATABASE_USER: 'myuser',
    PG_DATABASE_PASSWORD: 'mypass',
  });
  const config = await loadConfig();
  expect(config.database.driver).toBe('postgres');
  expect(config.database.postgres?.url).toBe('postgresql://myuser:mypass@db.example.com:5433/mydb');
});

test('loadConfig: PG_* uses defaults for missing values', async () => {
  setEnv({
    PG_HOST: 'db.example.com',
    // Port, db, user, password omitted
  });
  const config = await loadConfig();
  expect(config.database.postgres?.url).toBe('postgresql://nautalis:@db.example.com:5432/nautalis');
});

test('loadConfig: DATABASE_URL takes precedence over PG_*', async () => {
  setEnv({
    DATABASE_URL: 'postgresql://direct:pass@localhost:5432/directdb',
    PG_HOST: 'ignored',
  });
  const config = await loadConfig();
  expect(config.database.postgres?.url).toBe('postgresql://direct:pass@localhost:5432/directdb');
});

test('loadConfig: NAUTALIS_DB_POSTGRES_URL overrides others', async () => {
  setEnv({
    DATABASE_URL: 'postgresql://wrong:wrong@localhost:5432/wrong',
    NAUTALIS_DB_POSTGRES_URL: 'postgresql://correct:correct@localhost:5432/correct',
  });
  const config = await loadConfig();
  expect(config.database.postgres?.url).toBe('postgresql://correct:correct@localhost:5432/correct');
});

test('loadConfig: Supabase config via env vars', async () => {
  setEnv({
    NAUTALIS_DB_DRIVER: 'supabase',
    NAUTALIS_SUPABASE_URL: 'https://project.supabase.co',
    NAUTALIS_SUPABASE_SERVICE_KEY: 'secret-key',
  });
  const config = await loadConfig();
  expect(config.database.driver).toBe('supabase');
  expect(config.database.supabase?.projectUrl).toBe('https://project.supabase.co');
  expect(config.database.supabase?.serviceKey).toBe('secret-key');
});

test('loadConfig: NAUTALIS_DEPLOYMENT stored in config', async () => {
  setEnv({ NAUTALIS_DEPLOYMENT: 'docker' });
  const config = await loadConfig();
  expect(config.deployment).toBe('docker');
});

test('loadConfig: merges defaults, file, env, overrides correctly', async () => {
  // No file config, but env sets embeddings provider, overrides set LLM model
  setEnv({ NAUTALIS_EMBED_PROVIDER: 'openai' });
  const config = await loadConfig({
    llm: { model: 'custom-model' },
  });
  expect(config.embeddings.provider).toBe('openai');
  expect(config.llm.model).toBe('custom-model');
});

test('loadConfig: caches result when called multiple times without overrides', async () => {
  const config1 = await loadConfig();
  const config2 = await loadConfig();
  expect(config1).toBe(config2); // Same object (cached)
});

test('loadConfig: cache bypassed when overrides provided', async () => {
  const config1 = await loadConfig();
  const config2 = await loadConfig({ database: { driver: 'supabase' as any } });
  expect(config1).not.toBe(config2);
  expect((config2 as any).database.driver).toBe('supabase');
});

test('loadConfig: invalid DATABASE_URL format causes validation error', async () => {
  setEnv({ DATABASE_URL: 'not-a-valid-url' });
  await expect(loadConfig()).rejects.toThrow('Invalid configuration');
});

test('loadConfig: NAUTALIS_EMBED_OLLAMA_URL sets ollama config', async () => {
  setEnv({ NAUTALIS_EMBED_PROVIDER: 'ollama', NAUTALIS_EMBED_OLLAMA_URL: 'http://remote:11434' });
  const config = await loadConfig();
  expect(config.embeddings.ollama?.url).toBe('http://remote:11434');
});

test('loadConfig: NAUTALIS_LLM_OLLAMA_URL sets ollama config', async () => {
  setEnv({ NAUTALIS_LLM_PROVIDER: 'ollama', NAUTALIS_LLM_OLLAMA_URL: 'http://remote-llm:11434' });
  const config = await loadConfig();
  expect(config.llm.ollama?.url).toBe('http://remote-llm:11434');
});

test('getConfig: throws if not loaded', () => {
  resetConfig();
  expect(() => getConfig()).toThrow('Configuration not loaded');
});

test('resetConfig: clears cache', async () => {
  const config1 = await loadConfig();
  resetConfig();
  const config2 = await loadConfig({ database: { driver: 'supabase' as any } });
  expect(config1.database.driver).not.toBe(config2.database.driver);
});
