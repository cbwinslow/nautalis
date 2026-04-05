import { test, expect, beforeEach, afterEach } from "bun:test";
import { createEmbeddingService } from "../../src/memory/embed-factory.js";
import type { NautalisConfig } from "../../src/types/config.js";

// Clear module cache to reset singleton state if needed
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.COHERE_API_KEY;
  delete process.env.CUSTOM_EMBED_KEY;
});

test("createEmbeddingService: returns OllamaEmbeddingService for 'ollama' provider", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'ollama', model: 'nomic-embed-text' },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  const service = createEmbeddingService(config);
  expect(service).toBeDefined();
  expect(typeof service.embed).toBe('function');
});

test("createEmbeddingService: ollama uses custom URL if provided", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'ollama', model: 'custom', ollama: { url: 'http://custom:11434' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  const service = createEmbeddingService(config);
  expect(service).toBeDefined();
});

test("createEmbeddingService: throws for OpenAI when API key missing", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'openai', model: 'text-embedding-ada-002', openai: { apiKeyEnv: 'OPENAI_API_KEY' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  delete process.env.OPENAI_API_KEY;
  expect(() => createEmbeddingService(config)).toThrow('OpenAI API key not found');
});

test("createEmbeddingService: creates OpenAI embedding service when key present", () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'openai', model: 'text-embedding-ada-002', openai: { apiKeyEnv: 'OPENAI_API_KEY' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  const service = createEmbeddingService(config);
  expect(service).toBeDefined();
});

test("createEmbeddingService: throws for Cohere when API key missing", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'cohere', model: 'embed-english-v2.0', cohere: { apiKeyEnv: 'COHERE_API_KEY' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  delete process.env.COHERE_API_KEY;
  expect(() => createEmbeddingService(config)).toThrow('Cohere API key not found');
});

test("createEmbeddingService: creates Cohere embedding service when key present", () => {
  process.env.COHERE_API_KEY = 'cohere-test-key';
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'cohere', model: 'embed-english-v2.0', cohere: { apiKeyEnv: 'COHERE_API_KEY' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  const service = createEmbeddingService(config);
  expect(service).toBeDefined();
});

test("createEmbeddingService: custom provider requires baseUrl", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'custom', model: 'custom-model', custom: {} },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  expect(() => createEmbeddingService(config)).toThrow('Custom embedding provider requires baseUrl');
});

test("createEmbeddingService: custom provider creates service with baseUrl and optional apiKey", () => {
  process.env.CUSTOM_EMBED_KEY = 'custom-key';
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    embeddings: { provider: 'custom', model: 'custom-model', custom: { baseUrl: 'http://custom:8080', apiKeyEnv: 'CUSTOM_EMBED_KEY' } },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  const service = createEmbeddingService(config);
  expect(service).toBeDefined();
});

test("createEmbeddingService: unknown provider throws", () => {
  const config: NautalisConfig = {
    general: { userId: 'u', teamId: 't' },
    database: { driver: 'postgres', postgres: { url: 'p' } },
    // @ts-ignore - test invalid provider
    embeddings: { provider: 'unknown', model: 'test' },
    llm: { provider: 'ollama', model: 'test' },
    connectors: [],
    guardrails: { piiDetection: false },
  };

  expect(() => createEmbeddingService(config)).toThrow('Unsupported embedding provider');
});
