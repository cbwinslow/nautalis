import { test, expect, beforeEach, afterEach } from "bun:test";
import { RAGEngine } from "../../src/memory/rag.js";
import type { Store } from "../../src/store/interface.js";
import type { EmbeddingService } from "../../src/memory/embed.js";
import type { NautalisConfig } from "../../src/types/config.js";

// Mock Store
class MockStore implements Store {
  async insertEvent(_event: any) {}
  async insertMemory(_memory: any, _options?: any) {}
  async getMemory(_id: string, _options?: any) { return null; }
  async listMemories(_teamId: string, _options?: any) { return []; }
  async updateMemory(_id: string, _updates: any) {}
  async deleteMemory(_id: string) {}
  async findSimilarMemories(_embedding: number[], _teamId: string, _limit: number, _minScore?: number, _options?: any) {
    return [];
  }
  async getMemoriesByIds(_ids: string[], _options?: any) {
    // Return dummy memories matching ids
    return _ids.map((id, idx) => ({
      id,
      content: { summary: `Memory ${idx}`, detail: '' },
      classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' },
      agentIdentity: { agentName: 'test', toolName: 'test' },
      context: { teamId: 'team1', projectId: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
      relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] },
      lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false },
      embedding: [],
    }));
  }
  async queryMemories(_query: any) { return []; }
  async fullTextSearchMemories(_teamId: string, _query: string, _limit: number, _options?: any) {
    // Return results with a score attribute
    return [
      { memory: this.getMemoriesByIds(['mem1'])[0], score: 0.8 },
      { memory: this.getMemoriesByIds(['mem2'])[0], score: 0.7 },
    ];
  }
}

// Mock EmbeddingService
class MockEmbeddingService implements EmbeddingService {
  async embed(text: string) {
    return { embedding: [0.1, 0.2, 0.3], model: "mock", dimensions: 3 };
  }
}

// Mock VectorStoreIndex with asRetriever
class MockRetriever {
  private nodes: any[];
  constructor(nodes: any[]) {
    this.nodes = nodes;
  }
  async retrieve(query: string) {
    return this.nodes;
  }
}

class MockVectorStoreIndex {
  constructor(private nodes: any[]) {}
  asRetriever(options?: any) {
    return new MockRetriever(this.nodes);
  }
}

function createMockConfig(overrides: Partial<NautalisConfig> = {}): NautalisConfig {
  return {
    general: { teamId: "team1", userId: "user1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "ollama" as const, ollama: { url: "http://localhost:11434" } },
    llm: { provider: "ollama" as const, model: "nomic-embed-text" },
    rag: {},
    connectors: [],
    guardrails: { piiDetection: false },
    ...overrides,
  } as NautalisConfig;
}

test("RAGEngine: query with useHybrid combines vector and full-text results", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);

  // Mock the index to return one node with score 0.9
  const mockNode = {
    node: { metadata: { memory_id: 'vec1' } },
    score: 0.9,
  };
  // @ts-ignore - set private index
  rag.index = new MockVectorStoreIndex([mockNode]) as any;

  // Query with hybrid
  const results = await rag.query('test', { useHybrid: true, limit: 10 });

  // Should combine: vector gave mem1 (id: vec1) score 0.9, full-text gave mem1 and mem2.
  // Our MockStore.fullTextSearchMemories returns mem1 and mem2.
  // getMemoriesByIds will return memories for 'vec1', 'mem1', 'mem2'.
  expect(results.length).toBeGreaterThan(0);
  // Verify that scores are between 0 and 1
  results.forEach(r => {
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

test("RAGEngine: hybrid search with empty vector results returns full-text only", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);

  // No index means fallback to vector search; override to return empty
  store.findSimilarMemories = async () => [];

  // Mock full-text search to return some results
  store.fullTextSearchMemories = async () => [
    { memory: { id: 'ft1', content: { summary: 'FT1' } } as any, score: 0.8 },
    { memory: { id: 'ft2', content: { summary: 'FT2' } } as any, score: 0.6 },
  ];

  // Mock getMemoriesByIds
  store.getMemoriesByIds = async (ids: string[]) => {
    return ids.map(id => ({ id, content: { summary: id }, classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' }, agentIdentity: { agentName: 'test', toolName: 'test' }, context: { teamId: 'team1', projectId: '' }, createdAt: new Date(), updatedAt: new Date(), relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] }, lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false }, embedding: [] }));
  };

  const results = await rag.query('test', { useHybrid: true, limit: 10 });

  // Should return full-text results with normalized scores (maxFtScore=0.8, so scores 1.0 and 0.75)
  expect(results.length).toBe(2);
  expect(results[0].memory.id).toBe('ft1');
  expect(results[0].score).toBeCloseTo(0.5, 2); // vecNorm=0, ftNorm=1.0 → 0.5
  expect(results[1].memory.id).toBe('ft2');
  expect(results[1].score).toBeCloseTo(0.375, 2); // 0 + 0.75/2 = 0.375
});

test("RAGEngine: hybrid search with empty full-text results returns vector only", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);

  // Mock index to return vector results
  const mockNode = {
    node: { metadata: { memory_id: 'vec1' } },
    score: 0.9,
  };
  // @ts-ignore
  rag.index = new MockVectorStoreIndex([mockNode]) as any;

  // Override full-text to return empty
  store.fullTextSearchMemories = async () => [];

  // getMemoriesByIds already returns memory for 'vec1'
  store.getMemoriesByIds = async (ids: string[]) => {
    return ids.map(id => ({ id, content: { summary: id }, classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' }, agentIdentity: { agentName: 'test', toolName: 'test' }, context: { teamId: 'team1', projectId: '' }, createdAt: new Date(), updatedAt: new Date(), relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] }, lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false }, embedding: [] }));
  };

  const results = await rag.query('test', { useHybrid: true, limit: 10 });

  // Should return vector results, with hybrid score = 0.5 since ftNorm=0 and vecNorm=1
  expect(results.length).toBe(1);
  expect(results[0].memory.id).toBe('vec1');
  expect(results[0].score).toBeCloseTo(0.5, 2);
});

test("RAGEngine: hybrid search with overlapping results combines scores correctly", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);

  // Mock index to return two vector results with scores 0.9 and 0.5
  const mockNodes = [
    { node: { metadata: { memory_id: 'mem1' } }, score: 0.9 },
    { node: { metadata: { memory_id: 'mem2' } }, score: 0.5 },
  ];
  // @ts-ignore
  rag.index = new MockVectorStoreIndex(mockNodes) as any;

  // Full-text returns overlapping set: mem1 with 0.8 and mem3 with 0.7
  store.fullTextSearchMemories = async () => [
    { memory: { id: 'mem1', content: { summary: 'Mem1' } } as any, score: 0.8 },
    { memory: { id: 'mem3', content: { summary: 'Mem3' } } as any, score: 0.7 },
  ];

  store.getMemoriesByIds = async (ids: string[]) => {
    return ids.map(id => ({ id, content: { summary: id }, classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' }, agentIdentity: { agentName: 'test', toolName: 'test' }, context: { teamId: 'team1', projectId: '' }, createdAt: new Date(), updatedAt: new Date(), relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] }, lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false }, embedding: [] }));
  };

  const results = await rag.query('test', { useHybrid: true, limit: 10 });

  // mem1: vecNorm=0.9/0.9=1.0, ftNorm=0.8/0.8=1.0 → score = 1.0
  // mem2: vecNorm=0.5/0.9≈0.556, ftNorm=0 → score ≈0.278
  // mem3: vecNorm=0, ftNorm=0.7/0.8=0.875 → score ≈0.4375
  // Sorted: mem1 (1.0), mem3 (0.4375), mem2 (0.278)
  expect(results.length).toBe(3);
  expect(results[0].memory.id).toBe('mem1');
  expect(results[0].score).toBeCloseTo(1.0, 2);
  expect(results[1].memory.id).toBe('mem3');
  expect(results[1].score).toBeCloseTo(0.4375, 2);
  expect(results[2].memory.id).toBe('mem2');
  expect(results[2].score).toBeCloseTo(0.2778, 2);
});

test("RAGEngine: hybrid search respects limit after combining", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);

  // Mock many vector results
  const mockNodes = Array.from({ length: 10 }, (_, i) => ({
    node: { metadata: { memory_id: `vec${i}` } },
    score: 1 - i * 0.1,
  }));
  // @ts-ignore
  rag.index = new MockVectorStoreIndex(mockNodes) as any;

  // Full-text returns many results too
  const ftResults = Array.from({ length: 10 }, (_, i) => ({
    memory: { id: `ft${i}`, content: { summary: `FT${i}` } } as any,
    score: 1 - i * 0.1,
  }));
  store.fullTextSearchMemories = async () => ftResults;

  store.getMemoriesByIds = async (ids: string[]) => {
    return ids.map(id => ({ id, content: { summary: id }, classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' }, agentIdentity: { agentName: 'test', toolName: 'test' }, context: { teamId: 'team1', projectId: '' }, createdAt: new Date(), updatedAt: new Date(), relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] }, lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false }, embedding: [] }));
  };

  const results = await rag.query('test', { useHybrid: true, limit: 5 });

  // Should return at most 5 results
  expect(results.length).toBeLessThanOrEqual(5);
});

test("RAGEngine: query without index builds index automatically", async () => {
  const config = createMockConfig();
  const store = new MockStore() as any;
  const embeddingService = new MockEmbeddingService();

  const rag = new RAGEngine(config, store, embeddingService);
  // index is null initially
  expect((rag as any).index).toBeNull();

  // We'll let the query build index. Our MockStore should return enough memories for build.
  // The buildIndex calls store.findSimilarMemories with dummy vector and limit 10000.
  // We'll override findSimilarMemories to return some results.
  let buildCalled = false;
  store.findSimilarMemories = async (_embedding, _teamId, _limit, _minScore?, _options?) => {
    buildCalled = true;
    return [
      { memory: { id: 'm1', content: { summary: 'A' } } as any, score: 0.5 },
    ];
  };

  // Also need getMemoriesByIds to return full memories
  store.getMemoriesByIds = async (ids: string[]) => {
    return ids.map(id => ({ id, content: { summary: id }, classification: { memoryType: 'episodic', topics: [], importance: 0.5, sensitivity: 'internal' }, agentIdentity: { agentName: 'test', toolName: 'test' }, context: { teamId: 'team1', projectId: '' }, createdAt: new Date(), updatedAt: new Date(), relationships: { parentMemoryId: undefined, supersedes: [], contradicts: [], supports: [], tags: [] }, lifecycle: { ttl: undefined, decayRate: 0.01, lastAccess: new Date(), accessCount: 0, isStale: false }, embedding: [] }));
  };

  const results = await rag.query('test', { limit: 5 });
  expect(buildCalled).toBeTrue();
  expect(results.length).toBeGreaterThanOrEqual(0);
});
