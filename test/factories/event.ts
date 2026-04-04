import type { NautalisEvent } from '@/types/event.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event types for testing
 */
export const TEST_EVENT_TYPES = [
  'command',
  'file_edit',
  'decision',
  'error',
  'context',
  'tool_call',
  'chat',
] as const;

/**
 * Factory for creating test events
 */
export function createTestEvent(overrides: Partial<NautalisEvent> = {}): NautalisEvent {
  const now = new Date();

  return {
    id: `event_${uuidv4()}`,
    type: 'command',
    timestamp: now,
    agentId: 'test-agent',
    agentType: 'test',
    userId: 'user_123',
    sessionId: `session_${uuidv4()}`,
    payload: {
      command: 'test command',
      args: [],
      workingDir: '/test',
    },
    metadata: {
      project: 'test-project',
      workspace: '/test/workspace',
      files: ['test.ts'],
      language: ['typescript'],
      durationMs: 100,
      success: true,
    },
    ...overrides,
  };
}

/**
 * Create event with specific type
 */
export function createEventOfType<T extends NautalisEvent['type']>(
  type: T,
  overrides: Partial<NautalisEvent> = {},
): NautalisEvent {
  const basePayloads: Record<string, any> = {
    command: {
      command: 'npm install',
      args: ['lodash'],
      workingDir: '/project',
    },
    file_edit: {
      file: 'src/index.ts',
      edit: {
        from: 'old code',
        to: 'new code',
      },
      line: 42,
    },
    decision: {
      decision: 'Use PostgreSQL over SQLite',
      reasoning: 'Need multi-user support',
      alternatives: ['SQLite', 'Supabase'],
      impact: 'architectural',
    },
    error: {
      error: 'Connection timeout',
      stack: 'Error: timeout\n    at ...',
      recoverable: true,
    },
    context: {
      context: 'Previous work on auth module',
      source: 'memory retrieval',
      relevance: 0.85,
    },
    tool_call: {
      tool: 'web_search',
      input: 'TypeScript best practices 2026',
      result: 'Found 10 results',
    },
    chat: {
      role: 'user',
      content: 'How do I implement auth?',
      tokens: 150,
    },
  };

  return createTestEvent({
    type,
    payload: basePayloads[type] || {},
    ...overrides,
  });
}

/**
 * Create batch of events for testing
 */
export function createEventBatch(
  count: number,
  type: NautalisEvent['type'] = 'command',
  overrides: Partial<NautalisEvent> = {},
): NautalisEvent[] {
  return Array.from({ length: count }, (_, i) =>
    createEventOfType(type, {
      id: `event_${uuidv4()}_${i}`,
      timestamp: new Date(Date.now() - i * 60000), // 1 min apart
      ...overrides,
    }),
  );
}

/**
 * Create events from same session
 */
export function createSessionEvents(sessionId: string, count: number = 5): NautalisEvent[] {
  return createEventBatch(count, 'command', {
    sessionId,
    agentId: 'test-agent',
    userId: 'user_123',
  });
}

/**
 * Create events for specific agent
 */
export function createAgentEvents(agentId: string, count: number = 10): NautalisEvent[] {
  const types: NautalisEvent['type'][] = ['command', 'file_edit', 'decision', 'error'];

  return Array.from({ length: count }, (_, i) =>
    createEventOfType(types[i % types.length], {
      agentId,
      userId: `user_${agentId}`,
      sessionId: `session_${i}`,
      timestamp: new Date(Date.now() - i * 300000), // 5 min apart
    }),
  );
}
