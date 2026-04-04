import { describe, it, expect } from 'bun:test';
import { MemoryClassifier } from '../../src/memory/classify.js';
import type { NautalisEvent } from '../../src/types/event.js';

describe('MemoryClassifier', () => {
  const classifier = new MemoryClassifier();

  function createEvent(overrides: Partial<NautalisEvent> = {}): NautalisEvent {
    return {
      eventId: 'test-id',
      timestamp: new Date(),
      source: {
        toolName: 'test',
        toolVersion: '1.0',
        instanceId: 'inst',
        sessionId: 'sess',
        agentName: 'Test',
        userId: 'user1',
      },
      project: {
        teamId: 'team1',
        projectId: 'proj1',
        repoPath: '/repo',
        cwd: '/',
        platform: 'linux',
      },
      type: 'tool_use',
      toolName: 'Bash',
      filesInvolved: [],
      context: {
        teamId: 'team1',
        projectId: 'proj1',
        repoPath: '/repo',
        cwd: '/',
        platform: 'linux',
      },
      extracted: { decisions: [], errors: [], topics: [] },
      ...overrides,
    };
  }

  it('classifies decision events as decision memory type', () => {
    const event = createEvent({ type: 'decision' });
    const result = classifier.classify(event);
    expect(result.memoryType).toBe('decision');
  });

  it('classifies error events as lesson memory type', () => {
    const event = createEvent({ type: 'error', extracted: { decisions: [], errors: ['fail'], topics: [] } });
    const result = classifier.classify(event);
    expect(result.memoryType).toBe('lesson');
  });

  it('classifies conversation events as semantic', () => {
    const event = createEvent({ type: 'conversation' });
    const result = classifier.classify(event);
    expect(result.memoryType).toBe('semantic');
  });

  it('classifies tool_use as episodic by default', () => {
    const event = createEvent({ type: 'tool_use' });
    const result = classifier.classify(event);
    expect(result.memoryType).toBe('episodic');
  });

  it('extracts topics from tool name', () => {
    const event = createEvent({ toolName: 'Edit' });
    const result = classifier.classify(event);
    expect(result.topics).toContain('code_modification');
  });

  it('extracts topics from file paths', () => {
    const event = createEvent({ filesInvolved: ['/path/to/auth/login.ts'] });
    const result = classifier.classify(event);
    expect(result.topics).toContain('authentication');
  });

  it('includes custom topics from extracted.topics', () => {
    const event = createEvent({ extracted: { decisions: [], errors: [], topics: ['custom-topic'] } });
    const result = classifier.classify(event);
    expect(result.topics).toContain('custom-topic');
  });

  it('calculates confidence as 0.7 by default', () => {
    const event = createEvent({});
    const result = classifier.classify(event);
    expect(result.confidence).toBe(0.7);
  });

  it('detects high importance for decisions', () => {
    const event = createEvent({ type: 'decision' });
    const result = classifier.classify(event);
    expect(result.importance).toBeGreaterThan(0.5);
  });

  it('detects confidential sensitivity for files with sensitive names', () => {
    const event = createEvent({ filesInvolved: ['.env'] });
    const result = classifier.classify(event);
    expect(result.sensitivity).toBe('confidential');
  });

  it('defaults to internal sensitivity', () => {
    const event = createEvent({ filesInvolved: ['README.md'] });
    const result = classifier.classify(event);
    expect(result.sensitivity).toBe('internal');
  });
});
