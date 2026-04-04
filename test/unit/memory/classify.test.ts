import { describe, it, expect, beforeEach } from 'bun:test';
import { MemoryClassifier } from '@/memory/classify.js';
import type { NautalisEvent } from '@/types/event.js';

describe('MemoryClassifier', () => {
  let classifier: MemoryClassifier;

  beforeEach(() => {
    classifier = new MemoryClassifier();
  });

  describe('classify', () => {
    it('should classify a decision event as decision type', () => {
      const event: NautalisEvent = {
        eventId: 'evt_1',
        timestamp: new Date(),
        source: {
          toolName: 'claude-code',
          toolVersion: '1.0.0',
          instanceId: 'inst_1',
          sessionId: 'sess_1',
          agentName: 'Claude',
          userId: 'user_1',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'decision',
        extracted: {
          errors: [],
          topics: ['architecture'],
        },
        filesInvolved: ['src/auth.ts'],
      };

      const result = classifier.classify(event);

      expect(result.memoryType).toBe('decision');
      expect(result.blockLabel).toBe('architecture');
      expect(result.topics).toContain('architecture');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.importance).toBeDefined();
      expect(result.sensitivity).toBeDefined();
    });

    it('should classify an error event as lesson type', () => {
      const event: NautalisEvent = {
        eventId: 'evt_2',
        timestamp: new Date(),
        source: {
          toolName: 'kilo-code',
          toolVersion: '1.0.0',
          instanceId: 'inst_2',
          sessionId: 'sess_2',
          agentName: 'Kilo',
          userId: 'user_2',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'error',
        extracted: {
          errors: ['TypeError: Cannot read property'],
          topics: ['debugging'],
        },
        filesInvolved: ['src/utils.ts'],
      };

      const result = classifier.classify(event);

      expect(result.memoryType).toBe('lesson');
      expect(result.blockLabel).toBe('debugging');
      expect(result.topics).toContain('debugging');
    });

    it('should classify a tool_use event as episodic', () => {
      const event: NautalisEvent = {
        eventId: 'evt_3',
        timestamp: new Date(),
        source: {
          toolName: 'cursor',
          toolVersion: '0.45.0',
          instanceId: 'inst_3',
          sessionId: 'sess_3',
          agentName: 'Cursor',
          userId: 'user_3',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'tool_use',
        extracted: {
          errors: [],
          topics: ['refactoring'],
        },
        filesInvolved: ['src/components/Button.tsx'],
      };

      const result = classifier.classify(event);

      expect(result.memoryType).toBe('episodic');
    });

    it('should extract topics from tool name and file path', () => {
      const event: NautalisEvent = {
        eventId: 'evt_4',
        timestamp: new Date(),
        source: {
          toolName: 'bash',
          toolVersion: '1.0.0',
          instanceId: 'inst_4',
          sessionId: 'sess_4',
          agentName: 'Bash',
          userId: 'user_4',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'command',
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: ['src/auth/login.js'],
      };

      const result = classifier.classify(event);

      // From tool name "bash" should get command_execution
      expect(result.topics).toContain('code_modification');
      // From file path should get authentication
      expect(result.topics).toContain('authentication');
    });

    it('should calculate confidence within valid range', () => {
      const event: NautalisEvent = {
        eventId: 'evt_5',
        timestamp: new Date(),
        source: {
          toolName: 'test',
          toolVersion: '1.0.0',
          instanceId: 'inst_5',
          sessionId: 'sess_5',
          agentName: 'Test',
          userId: 'user_5',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'command',
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: [],
      };

      const result = classifier.classify(event);

      expect(result.confidence).toBeGreaterThanOrEqual(0.1);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});
