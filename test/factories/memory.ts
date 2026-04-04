import type { Memory, MemoryQuery, MemoryQueryResult, MemoryType } from '@/types/memory.js';
import { v4 as uuidv4 } from 'uuid';
import { subDays } from 'date-fns';

/**
 * Factory for creating test memories.
 * Usage: createTestMemory({ overrides: 'values' })
 *
 * Memory type has nested structure:
 * - classification.memoryType, classification.importance, classification.sensitivity
 * - content.summary, content.detail
 * - relationships.tags
 */
export function createTestMemory(overrides: Partial<Memory> = {}): Memory {
  const now = new Date();

  const baseMemory: Memory = {
    id: `mem_${uuidv4()}`,
    createdAt: now,
    updatedAt: now,
    agentIdentity: {
      agentId: 'test-agent',
      agentType: 'test',
      agentVersion: '1.0.0',
      userId: 'user_123',
      sessionId: 'session_456',
    },
    context: {
      project: 'test-project',
      workspace: '/test/workspace',
      files: ['test.ts'],
      language: ['typescript'],
      framework: [],
      branch: 'main',
    },
    classification: {
      memoryType: 'episodic',
      blockLabel: 'test-block',
      topics: ['test', 'unit'],
      confidence: 0.95,
      importance: 0.7,
      sensitivity: 'public',
    },
    content: {
      summary: 'Test memory summary',
      detail: 'Test memory detail content with enough length to be realistic',
      filesInvolved: ['test.ts'],
      commandsExec: [],
      errorsSeen: [],
      codeSnippets: [],
    },
    relationships: {
      parentMemoryId: undefined,
      supersedes: [],
      contradicts: [],
      supports: [],
      tags: ['test', 'unit'],
    },
    lifecycle: {
      decayRate: 0.1,
      lastAccess: now,
      accessCount: 0,
      isStale: false,
    },
    embedding: new Array(384).fill(0).map(() => Math.random()),
    ...overrides,
  };

  return baseMemory;
}

/**
 * Factory for creating memory query parameters
 */
export function createMemoryQuery(overrides: Partial<MemoryQuery> = {}): MemoryQuery {
  return {
    agentId: undefined,
    project: undefined,
    category: undefined,
    tags: [],
    status: 'active',
    dateRange: {
      start: undefined,
      end: undefined,
    },
    importance: undefined,
    sensitivity: undefined,
    limit: 10,
    offset: 0,
    ...overrides,
  };
}

/**
 * Factory for creating memory query results
 */
export function createMemoryQueryResult(
  overrides: Partial<MemoryQueryResult> = {},
): MemoryQueryResult {
  const memories = Array.from({ length: 10 }, (_, i) =>
    createTestMemory({
      id: `mem_${i}`,
      summary: `Test memory ${i}`,
    }),
  );

  return {
    memories,
    total: 100,
    limit: 10,
    offset: 0,
    hasMore: true,
    ...overrides,
  };
}

/**
 * Create a batch of memories for testing
 */
export function createTestMemories(count: number, overrides: Partial<Memory> = {}): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMemory({
      id: `mem_${uuidv4()}`,
      summary: `Test memory ${i}`,
      createdAt: subDays(new Date(), i),
      ...overrides,
    }),
  );
}

/**
 * Create memories with different categories for testing
 */
export function createCategorizedMemories(): Memory[] {
  return [
    createTestMemory({ category: 'decision', tags: ['architecture'] }),
    createTestMemory({ category: 'discovery', tags: ['pattern'] }),
    createTestMemory({ category: 'error', tags: ['bug', 'fix'] }),
    createTestMemory({ category: 'command', tags: ['terminal'] }),
    createTestMemory({ category: 'conversation', tags: ['chat'] }),
  ];
}

/**
 * Create memories with varying importance levels
 */
export function createImportanceVariants(): Memory[] {
  return ['low', 'medium', 'high', 'critical'].map((importance) =>
    createTestMemory({ importance: importance as Memory['importance'] }),
  );
}

/**
 * Create a batch of memories for testing
 */
export function createTestMemories(count: number, overrides: Partial<Memory> = {}): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMemory({
      id: `mem_${uuidv4()}`,
      content: { ...createTestMemory().content, summary: `Test memory ${i}` },
      createdAt: subDays(new Date(), i),
      ...overrides,
    }),
  );
}

/**
 * Create memories with different categories for testing
 */
export function createCategorizedMemories(): Memory[] {
  const types: MemoryType[] = [
    'episodic',
    'semantic',
    'procedural',
    'decision',
    'lesson',
    'preference',
  ];

  return types.map((memoryType) =>
    createTestMemory({
      classification: { ...createTestMemory().classification, memoryType },
      relationships: { ...createTestMemory().relationships, tags: [memoryType] },
    }),
  );
}

/**
 * Create memories with varying importance levels
 */
export function createImportanceVariants(): Memory[] {
  const importances = [0.1, 0.3, 0.5, 0.7, 0.9];

  return importances.map((importance) =>
    createTestMemory({
      classification: { ...createTestMemory().classification, importance },
    }),
  );
}

/**
 * Create memories with different sensitivity levels
 */
export function createSensitivityVariants(): Memory[] {
  const sensitivities: Array<'public' | 'internal' | 'confidential' | 'secret'> = [
    'public',
    'internal',
    'confidential',
    'secret',
  ];

  return sensitivities.map((sensitivity) =>
    createTestMemory({
      classification: { ...createTestMemory().classification, sensitivity },
    }),
  );
}

/**
 * Create memories for specific agent
 */
export function createAgentMemories(agentId: string, count: number = 5): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMemory({
      agentIdentity: { ...createTestMemory().agentIdentity, agentId },
      content: { ...createTestMemory().content, summary: `Memory from ${agentId} #${i}` },
    }),
  );
}

/**
 * Create related memories (chain)
 */
export function createMemoryChain(length: number = 3): Memory[] {
  const memories: Memory[] = [];
  let parentId: string | undefined = undefined;

  for (let i = 0; i < length; i++) {
    const memory = createTestMemory({
      relationships: {
        ...createTestMemory().relationships,
        parentMemoryId: parentId,
        derivedFrom: parentId ? [parentId] : [],
      },
    });
    memories.push(memory);
    parentId = memory.id;
  }

  return memories;
}

/**
 * Create memories for specific agent
 */
export function createAgentMemories(agentId: string, count: number = 5): Memory[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMemory({
      agentId,
      agentType: agentId.split('-')[0] || 'test',
      summary: `Memory from ${agentId} #${i}`,
    }),
  );
}

/**
 * Create related memories (chain)
 */
export function createMemoryChain(length: number = 3): Memory[] {
  const memories: Memory[] = [];
  let parentId: string | undefined = undefined;

  for (let i = 0; i < length; i++) {
    const memory = createTestMemory({
      parentMemoryId: parentId,
      derivedFrom: parentId ? [parentId] : [],
    });
    memories.push(memory);
    parentId = memory.id;
  }

  return memories;
}
