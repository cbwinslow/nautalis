import { describe, it, expect } from 'bun:test';
import { ProviderRegistry } from '../../src/providers/registry.js';
import { PROVIDER_CAPABILITIES } from '../../src/providers/base.js';

describe('ProviderRegistry', () => {
  describe('registry creation', () => {
    it('should create with empty config', () => {
      const registry = new ProviderRegistry({});
      expect(registry).toBeDefined();
    });

    it('should register and retrieve Ollama provider', () => {
      const registry = new ProviderRegistry({
        'my-ollama': {
          type: 'ollama',
          url: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
      });
      const provider = registry.getProvider('my-ollama');
      expect(provider).toBeDefined();
      expect(provider.capabilities).toEqual(PROVIDER_CAPABILITIES.ollama);
    });

    it('should throw for unknown provider', () => {
      const registry = new ProviderRegistry({});
      expect(() => registry.getProvider('nonexistent')).toThrow('Provider not found');
     });
   }); // close inner describe('registry creation')

   describe('provider selection', () => {
     it('should check provider existence', () => {
       const registry = new ProviderRegistry({
         'openai-test': { type: 'openai', apiKeyEnv: 'OPENAI_API_KEY', model: 'text-embedding-ada-002' },
       });
       expect(registry.hasProvider('openai-test')).toBe(true);
       expect(registry.hasProvider('missing')).toBe(false);
     });
   });
 });
