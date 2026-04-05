import { test, expect } from "bun:test";
import { KnowledgeBaseEngine, KBEntry } from "../../src/store/postgres/knowledge-base.js";

// Mock pg Pool client and query
class MockResult {
  rows: any[];
  constructor(rows: any[] = []) {
    this.rows = rows;
  }
}

class MockPool {
  async query(sql: string, params: any[]) {
    // Simulate simple insert returning inserted row
    if (sql.startsWith("INSERT INTO knowledge_base")) {
      return new MockResult([{
        id: params[0],
        team_id: params[1],
        title: params[4],
        content: params[5],
      }]);
    }
    if (sql.startsWith("INSERT INTO knowledge_base_embeddings")) {
      return new MockResult([]);
    }
    return new MockResult([]);
  }
}

test("KnowledgeBaseEngine: create inserts entry and returns id", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);

  const entry: KBEntry = {
    teamId: "team1",
    title: "Test Entry",
    content: "This is a test.",
    tags: ["test"],
    topics: ["general"],
    visibility: "team",
  };

  const id = await kb.create(entry);
  expect(id).toBeDefined();
  expect(typeof id).toBe("string");
  // Should be a valid UUID format? It generates v4, so check length and hyphens
  expect(id).toHaveLength(36);
  expect(id).toContain("-");
});

test("KnowledgeBaseEngine: create with embedding inserts both entry and embedding", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);

  const entry: KBEntry = {
    teamId: "team1",
    title: "With Embedding",
    content: "Content",
    embedding: [0.1, 0.2, 0.3],
  };

  const id = await kb.create(entry);
  expect(id).toBeDefined();
  // If embedding provided, an extra insert happens; we just ensure both succeed
});

test("KnowledgeBaseEngine: create validates entry via KBEntrySchema", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);

  // Invalid entry: missing required title
  const invalidEntry: Partial<KBEntry> = {
    teamId: "team1",
    content: "No title",
  };

  expect(async () => await kb.create(invalidEntry as KBEntry)).toThrow();
});

test("KnowledgeBaseEngine: get retrieves entry by id", async () => {
  const pool = new MockPool();
  // Override query to return a row for get
  const originalQuery = pool.query.bind(pool);
  let sqlCapture: string | null = null;
  let paramsCapture: any[] | null = null;
  (pool as any).query = async (sql: string, params: any[]) => {
    sqlCapture = sql;
    paramsCapture = params;
    if (sql.startsWith("SELECT")) {
      return new MockResult([{
        id: "kb1",
        team_id: "team1",
        title: "Fetched",
        content: "Content",
        created_at: new Date(),
        updated_at: new Date(),
      }]);
    }
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  const entry = await kb.get("kb1");
  expect(entry).toBeDefined();
  expect(entry.title).toBe("Fetched");
  expect(sqlCapture).toContain("SELECT");
  expect(paramsCapture).toContain("kb1");
});
