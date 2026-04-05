import { test, expect } from "bun:test";
import { PermissionManager } from "../../src/store/postgres/permissions.js";

// Mock pg Pool
type QueryResult = { rows: any[] };

class MockClient {
  private queries: Array<{ sql: string; params: any[]; result?: QueryResult }> = [];
  async query(sql: string, params: any[]): Promise<QueryResult> {
    // Record query for inspection
    this.queries.push({ sql, params });
    // Return appropriate results based on SQL
    if (sql.includes('SELECT role FROM team_members')) {
      return { rows: [{ role: 'member' }] };
    }
    if (sql.includes('SELECT granted FROM role_permissions')) {
      // Default: granted = true for testing
      return { rows: [{ granted: true }] };
    }
    if (sql.includes('SELECT * FROM team_permissions')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_log')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO team_permissions')) {
      return { rows: [{ team_id: params[0], user_id: params[1], scope: params[2], action: params[3], granted: params[4] }] };
    }
    return { rows: [] };
  }
  release() {
    // no-op
  }
  get queriesLog() {
    return this.queries;
  }
}

class MockPool {
  client: MockClient;
  constructor() {
    this.client = new MockClient();
  }
  async connect() {
    return this.client;
  }
  async query(sql: string, params: any[]) {
    // For simplicity, pool.query just delegates to client
    return this.client.query(sql, params);
  }
}

test("PermissionManager: check returns true when role has permission", async () => {
  const pool = new MockPool();
  const pm = new PermissionManager(pool as any);

  const granted = await pm.check("user1", "team1", "memory", "read");
  expect(granted).toBeTrue();
});

test("PermissionManager: check caches result", async () => {
  const pool = new MockPool();
  const pm = new PermissionManager(pool as any);

  const teamId = "team1";
  const userId = "user1";

  const first = await pm.check(userId, teamId, "memory", "read");
  expect(first).toBeTrue();

  // Ensure the query was called once
  const client = (pool as any).client;
  const selectCalls = client.queriesLog.filter(q => q.sql.includes('SELECT role FROM team_members'));
  expect(selectCalls.length).toBe(1);

  // Second call should hit cache (no new DB query)
  const second = await pm.check(userId, teamId, "memory", "write");
  expect(second).toBeTrue();
  const afterCalls = client.queriesLog.filter(q => q.sql.includes('SELECT role FROM team_members'));
  expect(afterCalls.length).toBe(1); // still only one
});

test("PermissionManager: grant inserts permission and audit log", async () => {
  const pool = new MockPool();
  const pm = new PermissionManager(pool as any);

  await pm.grant("team1", "user1", "memory", "export", true);
  const client = (pool as any).client;
  const queries = client.queriesLog;
  // Should have: SELECT (old), INSERT (team_permissions), INSERT (audit_log), COMMIT
  const select = queries.find(q => q.sql.includes('SELECT * FROM team_permissions'));
  expect(select).toBeDefined();
  const insertPerm = queries.find(q => q.sql.includes('INSERT INTO team_permissions'));
  expect(insertPerm).toBeDefined();
  expect(insertPerm.params).toContain("memory");
  expect(insertPerm.params).toContain("export");
  const audit = queries.find(q => q.sql.includes('INSERT INTO audit_log'));
  expect(audit).toBeDefined();
});

test("PermissionManager: clearCache clears cache", async () => {
  const pool = new MockPool();
  const pm = new PermissionManager(pool as any);

  await pm.check("user1", "team1", "memory", "read");
  pm.clearCache();

  // Accessing private cache is not possible; we can check that a second call triggers a new DB query
  const client = (pool as any).client;
  const initialSelectCount = client.queriesLog.filter(q => q.sql.includes('SELECT role FROM team_members')).length;
  await pm.check("user1", "team1", "memory", "read");
  const afterClearCount = client.queriesLog.filter(q => q.sql.includes('SELECT role FROM team_members')).length;
  expect(afterClearCount).toBe(initialSelectCount + 1);
});
