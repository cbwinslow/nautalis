import { test, expect, beforeEach, afterEach } from "bun:test";
import { OllamaLLM, LLMDecision } from "../../src/memory/ollama-llm.js";

// Mock fetch globally
let responses: any[] = [];
let capturedRequests: any[] = [];

const originalFetch = global.fetch;

beforeEach(() => {
  responses = [];
  capturedRequests = [];
  global.fetch = async (url: string, options: any) => {
    capturedRequests.push({ url, options });
    const response = responses.shift();
    if (response) {
      return response;
    }
    return { ok: true, json: async () => ({ message: { content: '[]' } }) };
  };
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchResponse(body: any, status: number = 200, statusText: string = "OK") {
  responses.push({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  });
}

test("OllamaLLM: constructor uses default values", () => {
  const llm = new OllamaLLM({});
  expect(llm.baseUrl).toBe("http://localhost:11434");
  expect(llm.model).toBe("qwen2.5:3b");
});

test("OllamaLLM: constructor accepts custom options", () => {
  const llm = new OllamaLLM({
    baseUrl: "http://custom:11434",
    model: "custom-model",
  });
  expect(llm.baseUrl).toBe("http://custom:11434");
  expect(llm.model).toBe("custom-model");
});

test("OllamaLLM: extractDecisions returns parsed decisions on valid JSON", async () => {
  mockFetchResponse({
    message: {
      content: '[{"decision":"use PostgreSQL","reasoning":"better scalability","alternatives":["SQLite"],"confidence":0.9,"impact":"high"}]',
    },
  });

  const llm = new OllamaLLM({});
  const decisions = await llm.extractDecisions("some text");

  expect(decisions).toHaveLength(1);
  expect(decisions[0].decision).toBe("use PostgreSQL");
  expect(decisions[0].reasoning).toBe("better scalability");
  expect(decisions[0].alternatives).toEqual(["SQLite"]);
  expect(decisions[0].confidence).toBe(0.9);
  expect(decisions[0].impact).toBe("high");
});

test("OllamaLLM: extractDecisions handles JSON in code block", async () => {
  mockFetchResponse({
    message: {
      content: '```json\n[{"decision":"test","reasoning":"because","alternatives":[],"confidence":0.5,"impact":"medium"}]\n```',
    },
  });

  const llm = new OllamaLLM({});
  const decisions = await llm.extractDecisions("text");
  expect(decisions).toHaveLength(1);
  expect(decisions[0].decision).toBe("test");
});

test("OllamaLLM: extractDecisions returns empty array when response is empty", async () => {
  mockFetchResponse({ message: { content: '[]' } });
  const llm = new OllamaLLM({});
  const decisions = await llm.extractDecisions("text");
  expect(decisions).toEqual([]);
});

test("OllamaLLM: extractDecisions returns empty array if not array", async () => {
  mockFetchResponse({ message: { content: '{"not":"array"}' } });
  const llm = new OllamaLLM({});
  const decisions = await llm.extractDecisions("text");
  expect(decisions).toEqual([]);
});

test("OllamaLLM: extractDecisions handles non-ok response (client error)", async () => {
  mockFetchResponse({ error: "bad" }, 400, "Bad Request");
  const llm = new OllamaLLM({
    retryConfig: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffFactor: 1 },
  });
  const decisions = await llm.extractDecisions("text");
  expect(decisions).toEqual([]); // catches error and returns empty
});

test("OllamaLLM: extractDecisions returns empty on server error", async () => {
  mockFetchResponse({ ok: false, status: 500, statusText: "Server Error" });
  const llm = new OllamaLLM({
    retryConfig: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffFactor: 1 },
  });
  const decisions = await llm.extractDecisions("text");
  expect(decisions).toEqual([]);
});

test("OllamaLLM: extractDecisions sends correct request to Ollama", async () => {
  mockFetchResponse({ message: { content: '[]' } });
  const llm = new OllamaLLM({ model: 'my-model' });
  await llm.extractDecisions("input text");

  expect(capturedRequests).toHaveLength(1);
  const req = capturedRequests[0];
  expect(req.url).toBe("http://localhost:11434/api/chat");
  const body = JSON.parse(req.options.body);
  expect(body.model).toBe("my-model");
  expect(body.messages).toHaveLength(2);
  expect(body.messages[0].role).toBe("system");
  expect(body.messages[1].role).toBe("user");
  expect(body.messages[1].content).toContain("input text");
});
