import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { KnowledgeBaseEngine } from '@/store/postgres/knowledge-base.js';
import type { Pool } from 'pg';

// Mock pg Pool
const createMockPool = () => ({
  query: vi.fn(),
});

describe('KnowledgeBaseEngine', () => {
  let engine: KnowledgeBaseEngine;
  let mockPool: Pool & { query: any };

  beforeEach(() => {
    mockPool = createMockPool() as any;
    engine = new KnowledgeBaseEngine(mockPool);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should insert a new knowledge base entry', async () => {
      const mockResult = {
        rows: [
          {
            id: 'kb_123',
            team_id: 'team_1',
            title: 'Test Entry',
            content: 'Test content',
            visibility: 'team',
            version: 1,
          },
        ],
      };
      mockPool.query.mockResolvedValueOnce(mockResult);
      // Mock the embedding generation call
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const entry = {
        teamId: 'team_1',
        title: 'Test Entry',
        content: 'Test content',
        contentType: 'markdown',
        category: 'guide',
        tags: ['test'],
        topics: ['testing'],
        visibility: 'team',
        source: 'manual',
        confidence: 1.0,
      };

      const id = await engine.create(entry);

      expect(id).toBe('kb_123');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO knowledge_base'),
        expect.arrayContaining(['team_1', 'Test Entry', 'Test content']),
      );
    });
  });

  describe('get', () => {
    it('should retrieve an entry by ID', async () => {
      const mockResult = {
        rows: [
          {
            id: 'kb_123',
            team_id: 'team_1',
            title: 'Test Entry',
            content: 'Test content',
          },
        ],
      };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await engine.get('kb_123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('kb_123');
    });

    it('should return null if entry not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await engine.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('query', () => {
    it('should return entries matching query', async () => {
      const mockResult = {
        rows: [
          { id: 'kb_1', title: 'Entry 1', content: 'Content 1', similarity: 0.85 },
          { id: 'kb_2', title: 'Entry 2', content: 'Content 2', similarity: 0.75 },
        ],
      };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const results = await engine.query('team_1', 'test query');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('kb_1');
    });

    it('should filter by category when provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await engine.query('team_1', 'test', { category: 'guide' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        expect.arrayContaining(['guide']),
      );
    });
  });

  describe('search', () => {
    it('should perform vector search when embedding provided', async () => {
      const embedding = new Array(384).fill(0.1);
      const mockResult = {
        rows: [{ id: 'kb_1', title: 'Result 1', content: 'Content 1', similarity: 0.92 }],
      };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const results = await engine.search('team_1', 'test query', embedding, { limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('kb_1');
      // Should use <=> operator for vector similarity
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('<=>'),
        expect.arrayContaining([expect.any(Array), 'team_1']),
      );
    });

    it('should fallback to full-text search without embedding', async () => {
      const mockResult = {
        rows: [{ id: 'kb_1', title: 'Result', content: 'Content', ts_rank: 0.5 }],
      };
      mockPool.query.mockResolvedValueOnce(mockResult);

      const results = await engine.search('team_1', 'test query');

      expect(results).toHaveLength(1);
      // Should use plain text search, not vector
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        expect.arrayContaining(['team_1', 'test query']),
      );
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // mocking embedding deletion separately
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await engine.update('kb_123', {
        title: 'Updated Title',
        content: 'Updated content',
        tags: ['updated', 'test'],
      });

      // Should have called update with correct SQL and parameters
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE knowledge_base SET'),
        expect.arrayContaining(['kb_123', 'Updated Title', 'Updated content']),
      );
    });
  });

  describe('delete', () => {
    it('should delete entry and its embeddings', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await engine.delete('kb_123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM knowledge_base_embeddings WHERE kb_id = $1',
        ['kb_123'],
      );
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM knowledge_base WHERE id = $1', [
        'kb_123',
      ]);
    });
  });
});
