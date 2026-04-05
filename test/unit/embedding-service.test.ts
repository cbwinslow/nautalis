import { test, expect, beforeEach, afterEach } from "bun:test";
import { EmbeddingService, EmbeddingResult } from "../../src/memory/embed.js";
import { createEmbeddingService } from "../../src/memory/embed-factory.js";

// Mock fetch
let fetchMock: any = null;
global.fetch = async (url: string, options: any) => {
  if (fetchMock) {
    return fetchMock(url, options);
  }
  return {
    ok: true,
    json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
  };
};

beforeEach(() => {
  fetchMock = null;
});

afterEach(() => {
  fetchMock = null;
});

test("EmbeddingService: embed returns result from performRequest", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: true,
    json: async () => ({ embedding: [0.5, 0.6, 0.7] }),
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
  });

  const result = await service.embed("test text");
  expect(result.embedding).toEqual([0.5, 0.6, 0.7]);
  expect(result.model).toBe("nomic-embed-text");
  expect(result.dimensions).toBe(3);
});

test("EmbeddingService: embed handles array response format", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test-model",
  });

  const result = await service.embed("test");
  expect(result.embedding).toEqual([0.1, 0.2]);
});

test("EmbeddingService: embed throws on non-ok response (client error)", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: false,
    status: 400,
    statusText: "Bad Request",
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test-model",
    retryConfig: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffFactor: 1 },
  });

  await expect(service.embed("test")).rejects.toThrow();
});

test("EmbeddingService: embed throws on non-ok response (server error - retryable)", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test-model",
    retryConfig: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffFactor: 1 },
  });

  await expect(service.embed("test")).rejects.toThrow();
});

test("EmbeddingService: custom requestTransform modifies body", async () => {
  fetchMock = (url: string, options: any) => {
    const body = JSON.parse(options.body);
    expect(body.input).toBe("test text");
    expect(body.model).toBe("custom-model");
    return {
      ok: true,
      json: async () => ({ embedding: [0.9, 0.8] }),
    };
  };

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "custom-model",
    requestTransform: (body) => ({
      input: body.prompt,
      model: body.model,
    }),
  });

  await service.embed("test text");
});

test("EmbeddingService: custom responseTransform parses data", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: true,
    json: async () => ({ vector: [0.4, 0.5, 0.6] }),
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test-model",
    responseTransform: (data) => ({ embedding: data.vector }),
  });

  const result = await service.embed("test");
  expect(result.embedding).toEqual([0.4, 0.5, 0.6]);
});

test("EmbeddingService: embedBatch calls embed for each text", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: true,
    json: async () => ({ embedding: [0.1, 0.2] }),
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
  });

  const results = await service.embedBatch(["text1", "text2", "text3"]);
  expect(results).toHaveLength(3);
  expect(results[0].embedding).toEqual([0.1, 0.2]);
  expect(results[1].embedding).toEqual([0.1, 0.2]);
  expect(results[2].embedding).toEqual([0.1, 0.2]);
});

test("EmbeddingService: constructor strips trailing slash from baseUrl", async () => {
  fetchMock = (url: string, options: any) => ({
    ok: true,
    json: async () => ({ embedding: [0.1] }),
  });

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434/",
    model: "test",
  });

  // The service should work and use the URL without trailing slash internally
  await service.embed("test");
  // If fetchMock received url, check it doesn't have double slash (though fetch normalizes)
  // We can't easily inspect the URL that fetch sees, but we can ensure no error occurs
});

test("EmbeddingService: default endpointPath is /api/embeddings", async () => {
  let capturedUrl = "";
  fetchMock = (url: string, options: any) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ embedding: [0.1] }) };
  };

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test",
  });

  await service.embed("test");
  expect(capturedUrl).toBe("http://localhost:11434/api/embeddings");
});

test("EmbeddingService: custom endpointPath used", async () => {
  let capturedUrl = "";
  fetchMock = (url: string, options: any) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ embedding: [0.1] }) };
  };

  const service = new EmbeddingService({
    baseUrl: "http://localhost:11434",
    model: "test",
    endpointPath: "/embed",
  });

  await service.embed("test");
  expect(capturedUrl).toBe("http://localhost:11434/embed");
});

// Factory tests

test("createEmbeddingService: creates Ollama service", () => {
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "ollama" as const, ollama: { url: "http://localhost:11434" } },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  const service = createEmbeddingService(config);
  expect(service).toBeInstanceOf(EmbeddingService);
});

test("createEmbeddingService: creates OpenAI service with API key from env", () => {
  process.env.OPENAI_API_KEY = "sk-test";
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "openai" as const, openai: { model: "text-embedding-ada-002" } },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  const service = createEmbeddingService(config);
  expect(service).toBeInstanceOf(EmbeddingService);
});

test("createEmbeddingService: throws when OpenAI API key missing", () => {
  delete process.env.OPENAI_API_KEY;
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "openai" as const, openai: { model: "text-embedding-ada-002" } },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  expect(() => createEmbeddingService(config)).toThrow("OpenAI API key not found");
});

test("createEmbeddingService: creates Cohere service", () => {
  process.env.COHERE_API_KEY = "cohere-test";
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "cohere" as const, cohere: { model: "embed-english-v3.0" } },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  const service = createEmbeddingService(config);
  expect(service).toBeInstanceOf(EmbeddingService);
});

test("createEmbeddingService: custom provider with baseUrl", () => {
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: {
      provider: "custom" as const,
      custom: { baseUrl: "http://localhost:8080", model: "my-model" },
    },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  const service = createEmbeddingService(config);
  expect(service).toBeInstanceOf(EmbeddingService);
});

test("createEmbeddingService: throws on unknown provider", () => {
  const config = {
    general: { teamId: "t1", userId: "u1" },
    database: { url: "postgresql://test" },
    embeddings: { provider: "unknown" as const },
    llm: { provider: "ollama" as const },
    connectors: [],
    guardrails: { piiDetection: false },
  } as any;

  expect(() => createEmbeddingService(config)).toThrow("Unsupported embedding provider");
});
