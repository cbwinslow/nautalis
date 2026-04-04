import { describe, it, expect } from 'bun:test';
import {
  createTestMemory,
  createTestMemories,
  createCategorizedMemories,
} from '../factories/memory.js';

describe('Memory Factories', () => {
  describe('createTestMemory', () => {
    it('should create a basic memory with default values', () => {
      const memory = createTestMemory();

      expect(memory.id).toBeDefined();
      expect(memory.id).toMatch(/^mem_/);
      expect(memory.agentId).toBe('test-agent');
      expect(memory.agentType).toBe('test');
      expect(memory.userId).toBe('user_123');
      expect(memory.sessionId).toBeDefined();
      expect(memory.project).toBe('test-project');
      expect(memory.summary).toBe('Test memory summary');
      expect(memory.detail).toBeDefined();
      expect(memory.embedding).toHaveLength(384);
      expect(memory.embeddingModel).toBe('nomic-embed-text');
      expect(memory.category).toBe('discovery');
      expect(memory.tags).toContain('test');
      expect(memory.tags).toContain('unit');
      expect(memory.confidence).toBe(0.95);
      expect(memory.importance).toBe('medium');
      expect(memory.sensitivity).toBe('public');
      expect(memory.status).toBe('active');
      expect(memory.piiDetected).toBe(false);
      expect(memory.createdAt).toBeInstanceOf(Date);
      expect(memory.updatedAt).toBeInstanceOf(Date);
    });

    it('should apply overrides to default values', () => {
      const customId = 'custom_memory_id';
      const memory = createTestMemory({
        id: customId,
        category: 'decision',
        importance: 'critical',
        tags: ['custom', 'override'],
      });

      expect(memory.id).toBe(customId);
      expect(memory.category).toBe('decision');
      expect(memory.importance).toBe('critical');
      expect(memory.tags).toEqual(['custom', 'override']);
      // Default values should remain
      expect(memory.agentId).toBe('test-agent');
    });

    it('should create memory with all required fields', () => {
      const memory = createTestMemory();
      assertValidMemory(memory);
    });
  });

  describe('createTestMemories', () => {
    it('should create specified count of memories', () => {
      const memories = createTestMemories(5);
      expect(memories).toHaveLength(5);
    });

    it('should create memories with unique IDs', () => {
      const memories = createTestMemories(100);
      const ids = memories.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });

    it('should apply overrides to all memories', () => {
      const memories = createTestMemories(3, { agentId: 'special-agent' });
      memories.forEach((memory) => {
        expect(memory.agentId).toBe('special-agent');
      });
    });
  });

  describe('createCategorizedMemories', () => {
    it('should create one memory of each category', () => {
      const memories = createCategorizedMemories();
      const categories = memories.map((m) => m.category);

      expect(categories).toContain('decision');
      expect(categories).toContain('discovery');
      expect(categories).toContain('error');
      expect(categories).toContain('command');
      expect(categories).toContain('conversation');
      expect(memories).toHaveLength(5);
    });
  });
});

/**
 * Helper function to validate memory structure
 * Used across multiple test files
 */
export function assertValidMemory(memory: any): void {
  expect(memory.id).toBeDefined();
  expect(typeof memory.id).toBe('string');
  expect(memory.id.length).toBeGreaterThan(0);

  expect(memory.agentId).toBeDefined();
  expect(memory.agentType).toBeDefined();
  expect(memory.userId).toBeDefined();
  expect(memory.sessionId).toBeDefined();

  expect(memory.project).toBeDefined();
  expect(memory.workspace).toBeDefined();
  expect(Array.isArray(memory.files)).toBe(true);
  expect(Array.isArray(memory.language)).toBe(true);

  expect(memory.category).toBeDefined();
  expect(Array.isArray(memory.tags)).toBe(true);
  expect(typeof memory.confidence).toBe('number');
  expect(memory.confidence).toBeGreaterThanOrEqual(0);
  expect(memory.confidence).toBeLessThanOrEqual(1);
  expect(memory.importance).toBeDefined();
  expect(memory.sensitivity).toBeDefined();

  expect(memory.summary).toBeDefined();
  expect(typeof memory.summary).toBe('string');
  expect(memory.detail).toBeDefined();
  expect(typeof memory.detail).toBe('string');

  expect(memory.embedding).toBeDefined();
  expect(Array.isArray(memory.embedding)).toBe(true);
  expect(memory.embedding).toHaveLength(384);

  expect(memory.createdAt).toBeInstanceOf(Date);
  expect(memory.updatedAt).toBeInstanceOf(Date);
  expect(memory.status).toBe('active');
  expect(typeof memory.accessCount).toBe('number');
}
