import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import { BaseProvider } from '../../src/providers/base.js';
import type { EmbeddingConfig, LLMConfig } from '../../src/types/config.js';

// Concrete implementation for testing
class TestProvider extends BaseProvider {
  async embed(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async generate(prompt: string): Promise<string> {
    return 'response';
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider({
      embeddings: { provider: 'test', model: 'test-model' } as EmbeddingConfig,
      llm: { provider: 'test', model: 'test-model' } as LLMConfig,
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create provider with config', () => {
    expect(provider).toBeInstanceOf(BaseProvider);
  });

  it('should implement embed method', async () => {
    const result = await provider.embed('test text');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('should implement generate method', async () => {
    const result = await provider.generate('test prompt');
    expect(result).toBe('response');
  });

  it('should handle embed errors', async () => {
    const failingProvider = {
      ...provider,
      embed: async () => { throw new Error('embed failed'); },
    };
    await expect(failingProvider.embed('test')).rejects.toThrow('embed failed');
  });

  it('should handle generate errors', async () => {
    const failingProvider = {
      ...provider,
      generate: async () => { throw new Error('generate failed'); },
    };
    await expect(failingProvider.generate('test')).rejects.toThrow('generate failed');
  });
});
