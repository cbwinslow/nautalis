import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { loadConfig } from '@/config/loader.js';
import type { NautalisConfig } from '@/types/config.js';

// Mock cosmiconfig
vi.mock('cosmiconfig', () => {
  return {
    cosmiconfig: vi.fn().mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
      load: vi.fn().mockResolvedValue(null),
    }),
  };
});

describe('ConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.DATABASE_URL;
    delete process.env.NAUTALIS_DB_DRIVER;
    delete process.env.NAUTALIS_EMBED_PROVIDER;
    delete process.env.NAUTALIS_LLM_PROVIDER;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  describe('loadConfig', () => {
    it('should load default configuration when no overrides', async () => {
      const config = await loadConfig();

      expect(config.general.userId).toBeDefined();
      expect(config.database.driver).toBe('postgres'); // default is postgres from defaults.ts
      expect(config.embeddings.provider).toBe('ollama');
      expect(config.llm.provider).toBe('ollama');
      expect(config.connectors).toBeInstanceOf(Array);
    });

    it('should override database driver from CLI options', async () => {
      const config = await loadConfig({
        database: { driver: 'supabase' as any },
      });

      expect(config.database.driver).toBe('supabase');
    });

    it('should use DATABASE_URL from environment', async () => {
      process.env.DATABASE_URL = 'postgresql://custom:custom@localhost:5432/custom';

      const config = await loadConfig();

      expect(config.database.postgres?.url).toBe(
        'postgresql://custom:custom@localhost:5432/custom',
      );
    });

    it('should override general.userId from options', async () => {
      const config = await loadConfig({
        general: { userId: 'custom-user' },
      });

      expect(config.general.userId).toBe('custom-user');
    });

    it('should set teamId from options when provided', async () => {
      const config = await loadConfig({
        general: { teamId: 'team-123' },
      });

      expect(config.general.teamId).toBe('team-123');
    });

    it('should throw error if database driver invalid', async () => {
      await expect(loadConfig({ database: { driver: 'sqlite' as any } })).rejects.toThrow(
        'Invalid database driver',
      );
    });

    it('should merge overrides correctly', async () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://custom:4318';

      const config = await loadConfig({
        database: {
          driver: 'supabase' as any,
          supabase: { projectUrl: 'https://custom.supabase.co', serviceKey: 'secret' },
        },
        embeddings: {
          provider: 'openai' as any,
          openai: { apiKeyEnv: 'OPENAI_API_KEY', model: 'text-embedding-3-small' },
        },
      });

      expect(config.database.driver).toBe('supabase');
      expect(config.database.supabase?.projectUrl).toBe('https://custom.supabase.co');
      expect(config.embeddings.provider).toBe('openai');
    });
  });
});
