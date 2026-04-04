import type { Agent } from '@/types/agent.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Factory for creating test agents
 */
export function createTestAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: `agent_${uuidv4()}`,
    type: 'claude-code',
    name: 'Test Agent',
    version: '1.0.0',
    description: 'A test AI agent',
    capabilities: ['code-generation', 'analysis'],
    config: {
      enabled: true,
      maxConcurrentSessions: 5,
      timeoutMs: 30000,
    },
    metadata: {
      createdAt: new Date(),
      lastSeenAt: new Date(),
      totalSessions: 0,
      totalEvents: 0,
    },
    ...overrides,
  };
}

/**
 * Create a Claude Code agent
 */
export function createClaudeAgent(overrides: Partial<Agent> = {}): Agent {
  return createTestAgent({
    type: 'claude-code',
    name: 'Claude Code',
    version: '0.2.0',
    capabilities: ['code-generation', 'analysis', 'refactoring'],
    ...overrides,
  });
}

/**
 * Create a Kilo Code agent
 */
export function createKiloAgent(overrides: Partial<Agent> = {}): Agent {
  return createTestAgent({
    type: 'kilo-code',
    name: 'Kilo Code',
    version: '0.1.0',
    capabilities: ['full-stack', 'testing', 'deployment'],
    ...overrides,
  });
}

/**
 * Create a Cursor agent
 */
export function createCursorAgent(overrides: Partial<Agent> = {}): Agent {
  return createTestAgent({
    type: 'cursor',
    name: 'Cursor',
    version: '0.45.0',
    capabilities: ['ide-integration', 'inline-edits', 'autocomplete'],
    ...overrides,
  });
}

/**
 * Create multiple agents of different types
 */
export function createMixedAgents(count: number = 3): Agent[] {
  const types: Array<'claude-code' | 'kilo-code' | 'cursor'> = [
    'claude-code',
    'kilo-code',
    'cursor',
  ];

  return Array.from({ length: count }, (_, i) =>
    createTestAgent({
      type: types[i % types.length],
      name: `${types[i % types.length]}-${Math.floor(i / types.length) + 1}`,
    }),
  );
}
