import { test, expect } from "bun:test";
import { DecisionExtractor } from "../../src/memory/extract.ts";
import type { NautalisEvent } from "../../src/types/event.ts";

// Mock OllamaLLM for testing
class MockOllamaLLM {
  async extractDecisions(text: string) {
    // Simulate LLM extraction
    return [
      {
        decision: "use PostgreSQL",
        reasoning: "better scalability",
        alternatives: ["SQLite"],
        confidence: 0.9,
        impact: "high",
      },
    ];
  }
}

function createMockEvent(overrides: Partial<NautalisEvent> = {}): NautalisEvent {
  return {
    id: "test-id",
    timestamp: new Date(),
    agentIdentity: { agentName: "test", toolName: "test" },
    eventType: "tool_use",
    toolName: "test",
    filesInvolved: [],
    toolOutput: { stdout: "", stderr: "" },
    cost: { total: 0, currency: "USD" },
    duration: 0,
    raw: {},
    ...overrides,
  } as NautalisEvent;
}

test("DecisionExtractor: returns empty array when no text present", async () => {
  const extractor = new DecisionExtractor();
  const event = createMockEvent({
    toolOutput: { stdout: "", stderr: "" },
    raw: {},
  });
  const decisions = await extractor.extract(event);
  expect(decisions).toEqual([]);
});

test("DecisionExtractor: extractWithRegex finds decisions", async () => {
  const extractor = new DecisionExtractor();
  const text = "We decided to use PostgreSQL. I chose PostgreSQL over SQLite.";
  const decisions = extractor.extractWithRegex(text);
  expect(decisions.length).toBeGreaterThan(0);
  expect(decisions.some(d => d.decision.includes("PostgreSQL"))).toBeTrue();
});

test("DecisionExtractor: inferTopic from filesInvolved", async () => {
  const extractor = new DecisionExtractor();
  const eventWithFile = createMockEvent({
    filesInvolved: ["src/models/user.ts"],
    toolOutput: { stdout: "We decided to add an index.", stderr: "" },
  });
  const decisions = await extractor.extract(eventWithFile);
  if (decisions.length > 0) {
    // The topic is inferred from the parent directory of the first file: "models"
    expect(decisions[0].topic).toBe("models");
  } else {
    fail("Expected at least one decision from regex");
  }
});

test("DecisionExtractor: LLM extraction preferred over regex", async () => {
  const mockLLM = new MockOllamaLLM();
  const extractor = new DecisionExtractor(mockLLM);
  const event = createMockEvent({
    toolOutput: { stdout: "We should adopt a microservices architecture.", stderr: "" },
  });
  const decisions = await extractor.extract(event);
  // LLM returns one decision with confidence 0.9
  expect(decisions.length).toBe(1);
  expect(decisions[0].decision).toBe("use PostgreSQL");
  expect(decisions[0].confidence).toBe(0.9);
});

test("DecisionExtractor: falls back to regex when LLM fails", async () => {
  // Mock LLM that throws error
  const failingLLM = {
    async extractDecisions() {
      throw new Error("LLM unavailable");
    },
  } as any;
  const extractor = new DecisionExtractor(failingLLM);
  const event = createMockEvent({
    toolOutput: { stdout: "We decided to refactor the code.", stderr: "" },
  });
  const decisions = await extractor.extract(event);
  expect(decisions.length).toBeGreaterThan(0);
});
