import { test, expect } from "bun:test";
import { CompositeProvider } from "../../src/providers/composite.js";
import type { ProviderConfig } from "../../src/types/config.js";
import { BaseProvider } from "../../src/providers/base.js";

// Mock provider
function createMockProvider(name: string, supportsEmbedding: boolean, supportsLLM: boolean) {
  return {
    name,
    capabilities: { embeddings: supportsEmbedding, llm: supportsLLM },
    supports: (type: 'embedding' | 'llm') => type === 'embedding' ? supportsEmbedding : supportsLLM,
    createEmbeddingService: () => ({ embed: async () => ({ embedding: [0.1] }) } as any),
    createLLM: () => ({ complete: async () => "ok" } as any),
  } as any as BaseProvider;
}

// Mock registry
class MockRegistry {
  private providers: Map<string, BaseProvider>;
  constructor(providers: BaseProvider[]) {
    this.providers = new Map(providers.map(p => [p.name, p]));
  }
  getProvider(name: string): BaseProvider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Provider "${name}" not found`);
    return p;
  }
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}

function createConfig(providers: string[]): ProviderConfig & { providers: string[] } {
  return {
    type: 'composite',
    providers,
  } as any;
}

test("CompositeProvider: constructs with valid providers", () => {
  const p1 = createMockProvider('ollama', true, true);
  const p2 = createMockProvider('openai', true, true);
  const registry = new MockRegistry([p1, p2]);
  const config = createConfig(['ollama', 'openai']);
  const composite = new CompositeProvider(config, registry);
  expect(composite).toBeDefined();
});

test("CompositeProvider: throws if provider not found", () => {
  const p1 = createMockProvider('ollama', true, true);
  const registry = new MockRegistry([p1]);
  const config = createConfig(['ollama', 'missing']);
  expect(() => new CompositeProvider(config, registry)).toThrow('CompositeProvider: provider "missing" not found or invalid');
});

test("CompositeProvider: selectProvider picks first that supports capability", () => {
  const p1 = createMockProvider('ollama', true, true);
  const p2 = createMockProvider('openai', true, true);
  const p3 = createMockProvider('anthropic', false, true);
  const registry = new MockRegistry([p1, p2, p3]);
  const config = createConfig(['ollama', 'openai', 'anthropic']);
  const composite = new CompositeProvider(config, registry);
  // select embedding: first two support, should return p1
  // We can access private via type assertion or call public methods that use it.
  const selectedEmbed = (composite as any).selectProvider('embedding');
  expect(selectedEmbed.name).toBe('ollama'); // because it's first that supports embedding
  const selectedLLM = (composite as any).selectProvider('llm');
  expect(selectedLLM.name).toBe('ollama'); // also supports LLM, first
});

test("CompositeProvider: createEmbeddingService delegates to embedding provider", () => {
  const p1 = createMockProvider('ollama', true, true);
  const p2 = createMockProvider('anthropic', false, true);
  const registry = new MockRegistry([p1, p2]);
  const config = createConfig(['ollama', 'anthropic']);
  const composite = new CompositeProvider(config, registry);
  const service = composite.createEmbeddingService();
  expect(service).toBeDefined();
  // It should be the service from p1
});

test("CompositeProvider: createLLM delegates to LLM provider", () => {
  const p1 = createMockProvider('ollama', true, true);
  const p2 = createMockProvider('cohere', true, false);
  const registry = new MockRegistry([p1, p2]);
  const config = createConfig(['ollama', 'cohere']);
  const composite = new CompositeProvider(config, registry);
  const llm = composite.createLLM();
  expect(llm).toBeDefined();
});

test("CompositeProvider: throws if no provider supports embedding", () => {
  const p1 = createMockProvider('anthropic', false, true);
  const p2 = createMockProvider('cohere', false, false);
  const registry = new MockRegistry([p1, p2]);
  const config = createConfig(['anthropic', 'cohere']);
  const composite = new CompositeProvider(config, registry);
  expect(() => composite.createEmbeddingService()).toThrow("no available provider supports embedding");
});

test("CompositeProvider: throws if no provider supports LLM", () => {
  const p1 = createMockProvider('cohere', true, false);
  const p2 = createMockProvider('some', false, false);
  const registry = new MockRegistry([p1, p2]);
  const config = createConfig(['cohere', 'some']);
  const composite = new CompositeProvider(config, registry);
  expect(() => composite.createLLM()).toThrow("CompositeProvider: no available provider supports llm");
});

test("CompositeProvider: construct error wraps original", () => {
  const badName = 'nonexistent';
  const registry = new MockRegistry([]);
  const config = createConfig([badName]);
  expect(() => new CompositeProvider(config, registry)).toThrow(`CompositeProvider: provider "${badName}" not found`);
});
