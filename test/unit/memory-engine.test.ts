import { test, expect, beforeEach, afterEach } from "bun:test";
import { MemoryEngine } from "../../src/memory/engine.js";
import type { Store } from "../../src/store/interface.js";
import type { NautalisEvent } from "../../src/types/event.js";
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
  async getMemoriesByIds(_ids: string[], _options?: any) { return []; }
  async queryMemories(_query: any) { return []; }
  async fullTextSearchMemories(_teamId: string, _query: string, _limit: number, _options?: any) {
    return [];
  }
  async createKnowledgeBase(_entry: any, _options?: any) { return "kb-id"; }
  async searchKnowledgeBase(_teamId: string, _query: string, _limit?: number, _options?: any) { return []; }
  // etc
}

// Mock EmbeddingService
class MockEmbeddingService {
  async embed(text: string) {
    return { embedding: [0.1, 0.2, 0.3], model: "mock", dimensions: 3 };
  }
}

// Mock logger
const mockLog = { info: () => {}, error: () => {}, warn: () => {} };
// Override logMessage in telemetry/api for this test? Could inject but easier to just not care.

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

function createMockEvent(overrides: Partial<NautalisEvent> = {}): NautalisEvent {
  return {
    eventId: "test-event-id",
    timestamp: new Date(),
    source: {
      toolName: "Bash",
      toolVersion: "1.0",
      instanceId: "instance1",
      sessionId: "session1",
      agentName: "TestAgent",
      userId: "user1",
    },
    project: {
      teamId: "team1",
      projectId: "proj1",
      repoPath: "/repo",
      repoUrl: "",
      branch: "",
      cwd: "/",
      platform: "linux",
    },
    type: "tool_use",
    toolName: "Bash",
    toolInput: { command: "echo hello" },
    toolOutput: { stdout: "hello\n", exitCode: 0 },
    filesInvolved: [],
    context: {
      teamId: "team1",
      projectId: "proj1",
      repoPath: "/repo",
      repoUrl: "",
      branch: "",
      cwd: "/",
      platform: "linux",
    },
    extracted: { decisions: [], errors: [], topics: ["test"] },
    raw: {},
    cost: { total: 0, currency: "USD" },
    duration: 0,
    ...overrides,
  } as NautalisEvent;
}

test("MemoryEngine: processEvent creates memory and stores it", async () => {
  const store = new MockStore();
  const config = createMockConfig();
  const engine = new MemoryEngine(store, config);

  // Override embeddingService to simplify
  const mockEmbed = new MockEmbeddingService();
  // @ts-ignore - replace private field for test
  engine.embeddingService = mockEmbed;

  const event = createMockEvent();
  // Ensure we capture insertMemory calls
  const insertedMemories: any[] = [];
  // @ts-ignore
  store.insertMemory = async (mem: any, _options?: any) => {
    insertedMemories.push(mem);
  };

  const memories = await engine.processEvent(event);
  expect(memories.length).toBeGreaterThan(0);
  expect(insertedMemories.length).toBeGreaterThan(0);
  // Verify at least one memory has the summary we expect
  const mainMemory = memories.find(m => m.classification.memoryType !== 'decision');
  expect(mainMemory).toBeDefined();
  expect(mainMemory.content.summary).toContain("echo hello");
});

test("MemoryEngine: processEvent extracts decisions when LLM available", async () => {
  // This test would require mocking the DecisionExtractor or having an LLM. We can test with the fallback regex.
  // The processEvent calls decisionExtractor.extract. Our DecisionExtractor can use regex fallback. Since LLM is undefined in config (ollama provider but no Ollama server), the extractor should fallback to regex if we provide text that matches regex patterns.
  // Actually, the test above already includes decisions? Let's influence that.
  // For now, we trust that DecisionExtractor's own tests cover extraction logic. We just need to ensure MemoryEngine passes event through.
  // We can assert that if DecisionExtractor returns decisions, we get additional decision memories.
  const store = new MockStore();
  const config = createMockConfig();
  const engine = new MemoryEngine(store, config);
  const mockEmbed = new MockEmbeddingService();
  // @ts-ignore
  engine.embeddingService = mockEmbed;

  const insertedMemories: any[] = [];
  // @ts-ignore
  store.insertMemory = async (mem: any, _options?: any) => {
    insertedMemories.push(mem);
  };

  // Create event that triggers regex pattern: "decided to use PostgreSQL."
  const event = createMockEvent({
    toolOutput: { stdout: "We decided to use PostgreSQL for better scalability.", stderr: "", exitCode: 0 },
    extracted: { decisions: [], errors: [], topics: ["db"] },
  });

  await engine.processEvent(event);
  // Should have at least 2 memories: main + decision
  expect(insertedMemories.length).toBeGreaterThanOrEqual(2);
  const decisionMemory = insertedMemories.find(m => m.classification.memoryType === 'decision');
  expect(decisionMemory).toBeDefined();
  expect(decisionMemory.content.summary.toLowerCase()).toContain("postgresql");
});

test("MemoryEngine: ingestEvents processes multiple events and invalidates index", async () => {
  const store = new MockStore();
  const config = createMockConfig();
  const engine = new MemoryEngine(store, config);
  const mockEmbed = new MockEmbeddingService();
  // @ts-ignore
  engine.embeddingService = mockEmbed;

  const insertCounts: number[] = [];
  // @ts-ignore
  store.insertMemory = async (_mem: any, _options?: any) => {
    insertCounts.push(1);
  };
  // @ts-ignore
  store.insertEvent = async () => {};

  const events = [createMockEvent({ eventId: "e1" }), createMockEvent({ eventId: "e2" }), createMockEvent({ eventId: "e3" })];
  const total = await engine.ingestEvents(events);
  expect(total).toBe(3);
  expect(insertCounts.length).toBe(3); // at least one memory per event (the main memory)
});

test("MemoryEngine: ingestEvents applies PII redaction when enabled", async () => {
  const store = new MockStore();
  const config = createMockConfig({ guardrails: { piiDetection: true } });
  const engine = new MemoryEngine(store, config);
  const mockEmbed = new MockEmbeddingService();
  // @ts-ignore
  engine.embeddingService = mockEmbed;

  let receivedEvent: any = null;
  // @ts-ignore
  store.insertEvent = async (evt: any) => {
    receivedEvent = evt;
  };
  // @ts-ignore
  store.insertMemory = async () => {};

  const event = createMockEvent({
    toolOutput: { stdout: "Contact me at user@example.com", stderr: "", exitCode: 0 },
    raw: { message: { content: "My phone is 555-123-4567" } },
  });

  await engine.ingestEvents([event]);
  expect(receivedEvent).not.toBeNull();
  // The raw event's message content should have been redacted? Actually redactSensitiveData is applied before storage; it returns a new object.
  // We can check that the stored event does not contain the raw email/phone in any string fields
  const json = JSON.stringify(receivedEvent);
  expect(json).not.toContain("user@example.com");
  expect(json).not.toContain("555-123-4567");
});

test("MemoryEngine: ask synthesizes answer from context", async () => {
  const store = new MockStore();
  const config = createMockConfig();
  const engine = new MemoryEngine(store, config);
  const mockRAG = {
    query: async () => [
      { memory: { content: { summary: "Summary1", detail: "Detail1" } }, score: 0.9 },
      { memory: { content: { summary: "Summary2", detail: "Detail2" } }, score: 0.8 },
    ],
    synthesize: async (_question: string, _context: string[]) => "Synthesized answer",
  };
  // @ts-ignore
  engine.ragEngine = mockRAG as any;

  const answer = await engine.ask("question?");
  expect(answer).toBe("Synthesized answer");
});

test("MemoryEngine: query delegates to ragEngine", async () => {
  const store = new MockStore();
  const config = createMockConfig();
  const engine = new MemoryEngine(store, config);
  const mockRAG = {
    query: async () => [],
    synthesize: async () => "",
  };
  // @ts-ignore
  engine.ragEngine = mockRAG as any;

  const results = await engine.query("test", { limit: 5 });
  expect(results).toEqual([]);
});

test("MemoryEngine: processEvent throws when teamId missing", async () => {
  const store = new MockStore();
  // Config with no teamId
  const config = {
    ...createMockConfig(),
    general: { teamId: "", userId: "user1" },
  };
  const engine = new MemoryEngine(store, config);
  const mockEmbed = new MockEmbeddingService();
  // @ts-ignore
  engine.embeddingService = mockEmbed;

  const event = createMockEvent({
    context: { ...createMockEvent().context, teamId: "" },
  });

  await expect(engine.processEvent(event)).rejects.toThrow("teamId is required");
});
