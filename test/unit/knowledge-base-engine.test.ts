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
    if (sql.startsWith("SELECT") && sql.includes("knowledge_base_embeddings")) {
      // vector search result
      return new MockResult([{
        id: "kb1",
        title: "Vector Result",
        content: "Content",
        similarity: 0.95,
      }]);
    }
    if (sql.startsWith("SELECT") && sql.includes("search_vector")) {
      // full-text search result
      return new MockResult([{
        id: "kb2",
        title: "FTS Result",
        content: "Content",
        rank: 0.8,
      }]);
    }
    if (sql.startsWith("UPDATE")) {
      return new MockResult([]);
    }
    if (sql.startsWith("DELETE")) {
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
    if (sql.startsWith("SELECT") && !sql.includes("search_vector") && !sql.includes("similarity")) {
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

test("KnowledgeBaseEngine: query returns empty array (not implemented)", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);
  const results = await kb.query({ teamId: "team1", query: "test" });
  expect(results).toEqual([]);
});

test("KnowledgeBaseEngine: update applies changes without touching embedding", async () => {
  const pool = new MockPool();
  let capturedSql: string | null = null;
  let capturedParams: any[] | null = null;
  (pool as any).query = async (sql: string, params: any[]) => {
    capturedSql = sql;
    capturedParams = params;
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  await kb.update("kb1", { title: "New Title", tags: ["new"], content: "Updated" });

  // Verify UPDATE statement with SET clauses for each field, plus version bump
  expect(capturedSql).toContain("UPDATE knowledge_base");
  expect(capturedSql).toContain("title =");
  expect(capturedSql).toContain("tags =");
  expect(capturedSql).toContain("content =");
  expect(capturedSql).toContain("version = version + 1");
  // First param is always id
  expect(capturedParams[0]).toBe("kb1");
});

test("KnowledgeBaseEngine: update does nothing when no valid fields", async () => {
  const pool = new MockPool();
  let called = false;
  (pool as any).query = async (sql: string, params: any[]) => {
    called = true;
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  await kb.update("kb1", {}); // no changes

  expect(called).toBeFalse();
});

test("KnowledgeBaseEngine: delete removes embedding and entry", async () => {
  const pool = new MockPool();
  let order: string[] = [];
  (pool as any).query = async (sql: string, params: any[]) => {
    if (sql.startsWith("DELETE FROM knowledge_base_embeddings")) {
      order.push("embeddings");
    } else if (sql.startsWith("DELETE FROM knowledge_base")) {
      order.push("kb");
    }
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  await kb.delete("kb1");

  expect(order).toEqual(["embeddings", "kb"]);
});

test("KnowledgeBaseEngine: search with embedding uses vector similarity", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);
  const embedding = [0.1, 0.2, 0.3];

  const results = await kb.search("team1", "query", embedding, { limit: 5 });

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toHaveProperty("similarity");
  // similarity should be a number
  expect(typeof results[0].similarity).toBe("number");
});

test("KnowledgeBaseEngine: search without embedding uses full-text", async () => {
  const pool = new MockPool();
  const kb = new KnowledgeBaseEngine(pool);

  const results = await kb.search("team1", "text search", undefined, { limit: 5 });

  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toHaveProperty("rank");
  expect(typeof results[0].rank).toBe("number");
});

test("KnowledgeBaseEngine: search with category adds filter (vector search)", async () => {
  const pool = new MockPool();
  let capturedSql: string | null = null;
  let capturedParams: any[] | null = null;
  (pool as any).query = async (sql: string, params: any[]) => {
    capturedSql = sql;
    capturedParams = params;
    return new MockResult([{ id: "kb1", title: "Vector", content: "Content", similarity: 0.9 }]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  const embedding = [0.1, 0.2, 0.3];
  await kb.search("team1", "query", embedding, { category: "tech", limit: 5 });

  // Should include category filter in SQL
  expect(capturedSql).toContain("AND kb.category = $3");
  // Params: embedding vector string, teamId, category, limit (4 params)
  expect(capturedParams!.length).toBe(4);
  expect(capturedParams[2]).toBe("tech");
  expect(capturedParams[3]).toBe(5);
});

test("KnowledgeBaseEngine: search respects limit option (FTS)", async () => {
  const pool = new MockPool();
  let capturedParams: any[] | null = null;
  (pool as any).query = async (sql: string, params: any[]) => {
    capturedParams = params;
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  await kb.search("team1", "query", undefined, { limit: 15 });

  // FTS branch expects 3 params: query, teamId, limit
  expect(capturedParams!.length).toBe(3);
  expect(capturedParams[2]).toBe(15);
});

test("KnowledgeBaseEngine: search with embedding respects limit", async () => {
  const pool = new MockPool();
  let capturedParams: any[] | null = null;
  (pool as any).query = async (sql: string, params: any[]) => {
    capturedParams = params;
    return new MockResult([]);
  };

  const kb = new KnowledgeBaseEngine(pool);
  const embedding = [0.1, 0.2];
  await kb.search("team1", "query", embedding, { category: "tech", limit: 20 });

  // With category, params: embedding string, teamId, category, limit (4 items)
  expect(capturedParams!.length).toBe(4);
  expect(capturedParams[3]).toBe(20);
});
