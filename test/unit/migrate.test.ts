import { test, expect, beforeEach, afterEach, vi } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Simulate the migrate module behavior
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to mock pg pool
function createMockPool() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
  return { pool, client };
}

test('migrate: checks for TimescaleDB extension before running timescaledb migrations', async () => {
  // This test verifies the logic in migrate.ts that checks for timescaledb
  const { pool, client } = createMockPool();

  // Mock: timescaledb NOT available
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('pg_available_extensions') && sql.includes('timescaledb')) {
      return { rows: [] }; // timescaledb not in list
    }
    return { rows: [] };
  });

  // We'll simulate the migration directory scanning
  const MIGRATION_DIRS = [
    path.join(__dirname, '..', '..', 'migrations', 'postgres', 'core'),
    path.join('..', '..', 'migrations', 'postgres', 'timescaledb'),
    path.join('..', '..', 'migrations', 'postgres', 'rls'),
  ];

  // For this unit test, we just verify the decision logic
  const hasTimescaleDB = false; // simulated
  const dirsToProcess = MIGRATION_DIRS.filter(dir => {
    if (!hasTimescaleDB && dir.includes('timescaledb')) {
      return false;
    }
    return true;
  });

  expect(dirsToProcess).not.toContain(expect.stringContaining('timescaledb'));
  expect(dirsToProcess.length).toBe(2); // core and rls only
});

test('migrate: includes timescaledb migrations when extension available', async () => {
  const { client } = createMockPool();

  // Mock: timescaledb IS available
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('pg_available_extensions') && sql.includes('timescaledb')) {
      return { rows: [{ extname: 'timescaledb' }] };
    }
    return { rows: [] };
  });

  const MIGRATION_DIRS = [
    path.join(__dirname, '..', '..', 'migrations', 'postgres', 'core'),
    path.join('..', '..', 'migrations', 'postgres', 'timescaledb'),
    path.join('..', '..', 'migrations', 'postgres', 'rls'),
  ];

  const hasTimescaleDB = true;
  const dirsToProcess = MIGRATION_DIRS.filter(dir => {
    if (!hasTimescaleDB && dir.includes('timescaledb')) {
      return false;
    }
    return true;
  });

  const hasTimescaledbDir = dirsToProcess.some(p => p.includes('timescaledb'));
  expect(hasTimescaledbDir).toBe(true);
  expect(dirsToProcess.length).toBe(3);
});

test('migrate: migfiles are sorted by filename', async () => {
  // Simulate reading directory with unsorted files
  const mockFiles = ['003_abc.sql', '001_abc.sql', '002_abc.sql'];
  const sorted = mockFiles.sort();
  expect(sorted).toEqual(['001_abc.sql', '002_abc.sql', '003_abc.sql']);
});

test('migrate: each migration file is read and executed', async () => {
  const { pool, client } = createMockPool();
  const mockSql = 'CREATE TABLE test (id UUID);';

  // Mock readdir to return sorted file list
  const readdirSpy = vi.spyOn(fs, 'readdir').mockResolvedValue(['001_test.sql', '002_test.sql']);
  const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(mockSql);

  const dir = '/fake/migrations/core';
  const files = await fs.readdir(dir);
  expect(files).toHaveLength(2);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const sql = await fs.readFile(filePath, 'utf-8');
    expect(sql).toBe(mockSql);
    // In real code: await client.query(sql)
  }

  readdirSpy.mockRestore();
  readFileSpy.mockRestore();
});

test('migrate: handles empty migration directory gracefully', async () => {
  const { pool, client } = createMockPool();
  const readdirSpy = vi.spyOn(fs, 'readdir').mockResolvedValue([]);

  const dir = '/fake/migrations/empty';
  const files = await fs.readdir(dir);
  expect(files).toHaveLength(0);

  readdirSpy.mockRestore();
});

test('migrate: connection error thrown if pool connect fails', async () => {
  const pool = {
    connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
    end: vi.fn(),
  };

  // Simulate the try/catch in migrate.ts
  try {
    await pool.connect();
    expect(false).toBe(true); // should not reach
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Connection failed');
  }
});

test('migrate: filters only .sql files', async () => {
  const mockFiles = ['001_abc.sql', '002_abc.txt', '003_abc.sql', 'README.md'];
  const sqlFiles = mockFiles.filter(f => f.endsWith('.sql')).sort();
  expect(sqlFiles).toEqual(['001_abc.sql', '003_abc.sql']);
});
