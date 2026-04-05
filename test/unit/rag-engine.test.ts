import { test, expect } from "bun:test";
import type { Store } from "../../src/store/interface.ts";
import type { EmbeddingService } from "../../src/memory/embed.ts";
import type { NautalisConfig } from "../../src/types/config.ts";
import { RAGEngine } from "../../src/memory/rag.ts";

// Mock Store
class MockStore implements Store {
  async insertEvent(_event: any) {}
  async insertMemory(_memory: any) {}
  async getMemory(_id: string, _options?: any) {}
  async listMemories(_teamId: string, _options?: any) { return []; }
  async updateMemory(_id: string, _updates: any) {}
  async deleteMemory(_id: string) {}
  async findSimilarMemories(_embedding: number[], _teamId: string, _limit: number, _minScore?: number, _options?: any) {
    return [];
  }
  async getMemoriesByIds(_ids: string[], _options?: any) { return []; }
  async queryMemories(_query: any) { return []; }
  async fullTextSearchMemories(_teamId: string, _query: string, _limit: number, _options?: any) {
    return [];
  }
  // other methods omitted for brevity
}

// Mock EmbeddingService
class MockEmbeddingService implements EmbeddingService {
  async embed(_text: string) {
    return { embedding: [0.1, 0.2, 0.3] };
  }
}

function createMockConfig(overrides: Partial<NautalisConfig> = {}): NautalisConfig {
  return {
    general: { teamId: "team1", userId: "user1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "ollama" },
    llm: { provider: "ollama" },
    rag: {},
    connectors: [],
    guardrails: { piiDetection: false },
    ...overrides,
  } as NautalisConfig;
}

test("RAGEngine: invalidateIndex clears index", () => {
  const rag = new RAGEngine(
    createMockConfig(),
    new MockStore(),
    new MockEmbeddingService()
  );
  // @ts-ignore - access private for test
  rag.index = { asRetriever: () => ({ retrieve: async () => [] }) } as any;
  expect(rag).toBeDefined();
  // Invalidate
  rag.invalidateIndex();
  // @ts-ignore - verify index is null
  expect(rag.index).toBeNull();
});

test("RAGEngine: constructor configures settings", () => {
  const rag = new RAGEngine(
    createMockConfig(),
    new MockStore(),
    new MockEmbeddingService()
  );
  // Just ensure construction succeeds
  expect(rag).toBeInstanceOf(RAGEngine);
});

test("RAGEngine: buildIndex calls store.findSimilarMemories", async () => {
  const mockStore = new MockStore();
  const embeddingService = new MockEmbeddingService();
  const rag = new RAGEngine(
    createMockConfig(),
    mockStore,
    embeddingService
  );

  // Test that buildIndex calls findSimilarMemories. We'll need to spy or replace method temporarily.
  // Use simple mock with counted calls
  let called = false;
  mockStore.findSimilarMemories = async () => {
    called = true;
    return [];
  };

  await rag.buildIndex("team1");
  expect(called).toBeTrue();
});
