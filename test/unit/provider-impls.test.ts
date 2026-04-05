import { test, expect } from "bun:test";
import { OllamaProvider } from "../../src/providers/ollama.js";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { AnthropicProvider } from "../../src/providers/anthropic.js";
import { CohereProvider } from "../../src/providers/cohere.js";

function createOllamaConfig(overrides: Partial<any> = {}): any {
  return {
    type: 'ollama',
    model: 'test-model',
    url: 'http://localhost:11434',
    ...overrides,
  };
}

function createOpenAIConfig(overrides: Partial<any> = {}): any {
  return {
    type: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    model: 'text-embedding-ada-002',
    ...overrides,
  };
}

function createAnthropicConfig(overrides: Partial<any> = {}): any {
  return {
    type: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    model: 'claude-3-opus',
    ...overrides,
  };
}

function createCohereConfig(overrides: Partial<any> = {}): any {
  return {
    type: 'cohere',
    apiKeyEnv: 'COHERE_API_KEY',
    model: 'embed-english-v3.0',
    ...overrides,
  };
}

test("OllamaProvider: createEmbeddingService returns EmbeddingService", () => {
  const provider = new OllamaProvider(createOllamaConfig());
  const service = provider.createEmbeddingService();
  expect(service).toBeDefined();
});

test("OllamaProvider: createLLM returns Ollama instance", () => {
  const provider = new OllamaProvider(createOllamaConfig());
  const llm = provider.createLLM();
  expect(llm).toBeDefined();
});

test("OpenAIProvider: createEmbeddingService returns EmbeddingService", () => {
  process.env.OPENAI_API_KEY = "sk-test";
  const provider = new OpenAIProvider(createOpenAIConfig());
  const service = provider.createEmbeddingService();
  expect(service).toBeDefined();
});

test("OpenAIProvider: createLLM returns OpenAI instance", () => {
  process.env.OPENAI_API_KEY = "sk-test";
  const provider = new OpenAIProvider(createOpenAIConfig());
  const llm = provider.createLLM();
  expect(llm).toBeDefined();
});

test("AnthropicProvider: createLLM returns Anthropic instance", () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  const provider = new AnthropicProvider(createAnthropicConfig());
  const llm = provider.createLLM();
  expect(llm).toBeDefined();
});

test("AnthropicProvider: createEmbeddingService throws (no embeddings support)", () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  const provider = new AnthropicProvider(createAnthropicConfig());
  expect(() => provider.createEmbeddingService()).toThrow("AnthropicProvider does not support embeddings");
});

test("CohereProvider: createEmbeddingService returns EmbeddingService", () => {
  process.env.COHERE_API_KEY = "cohere-test";
  const provider = new CohereProvider(createCohereConfig());
  const service = provider.createEmbeddingService();
  expect(service).toBeDefined();
});

test("CohereProvider: createLLM throws (no LLM support)", () => {
  process.env.COHERE_API_KEY = "cohere-test";
  const provider = new CohereProvider(createCohereConfig());
  expect(() => provider.createLLM()).toThrow("CohereProvider does not support LLM generation");
});
