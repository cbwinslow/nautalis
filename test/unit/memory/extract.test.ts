import { describe, it, expect } from 'bun:test';
import { DecisionExtractor } from '@/memory/extract.js';
import type { NautalisEvent } from '@/types/event.js';

describe('DecisionExtractor', () => {
  let extractor: DecisionExtractor;

  beforeEach(() => {
    extractor = new DecisionExtractor();
  });

  describe('extract', () => {
    it('should extract decisions from tool output', async () => {
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
        type: 'command',
        toolOutput: {
          stdout: 'We decided to use PostgreSQL for the database. Chose Postgres over SQLite.',
          stderr: '',
          exitCode: 0,
        },
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: ['src/db/schema.ts'],
      };

      const decisions = await extractor.extract(event);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].decision).toContain('PostgreSQL');
      expect(decisions[0].alternatives).toContain('SQLite');
      expect(decisions[0].confidence).toBe(0.6);
      expect(decisions[0].filesInvolved).toContain('src/db/schema.ts');
    });

    it('should extract decisions from conversation messages', async () => {
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
        type: 'chat',
        raw: {
          message: {
            content: "I'm going with React for the UI framework because it's familiar.",
            role: 'assistant',
          },
        },
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: [],
      };

      const decisions = await extractor.extract(event);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].decision).toContain('React');
    });

    it('should return empty array if no decision patterns found', async () => {
      const event: NautalisEvent = {
        eventId: 'evt_3',
        timestamp: new Date(),
        source: {
          toolName: 'test',
          toolVersion: '1.0.0',
          instanceId: 'inst_3',
          sessionId: 'sess_3',
          agentName: 'Test',
          userId: 'user_3',
        },
        project: {
          teamId: 'team_1',
          projectId: 'proj_1',
          repoPath: '/repo',
          cwd: '/repo',
          platform: 'linux',
        },
        type: 'command',
        toolOutput: {
          stdout: 'Just some normal output without decisions.',
          stderr: '',
          exitCode: 0,
        },
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: [],
      };

      const decisions = await extractor.extract(event);

      expect(decisions).toHaveLength(0);
    });

    it('should infer topic from file path when available', async () => {
      const event: NautalisEvent = {
        eventId: 'evt_4',
        timestamp: new Date(),
        source: {
          toolName: 'test',
          toolVersion: '1.0.0',
          instanceId: 'inst_4',
          sessionId: 'sess_4',
          agentName: 'Test',
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
        toolOutput: {
          stdout: 'We decided to implement OAuth.',
          stderr: '',
          exitCode: 0,
        },
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: ['src/auth/middleware.ts'],
      };

      const decisions = await extractor.extract(event);

      expect(decisions.length).toBeGreaterThan(0);
      // Topic inferred from file path directory: 'auth'
      expect(decisions[0].topic).toBe('auth');
    });

    it('should fallback to toolName for topic if no files', async () => {
      const event: NautalisEvent = {
        eventId: 'evt_5',
        timestamp: new Date(),
        source: {
          toolName: 'kilocode',
          toolVersion: '1.0.0',
          instanceId: 'inst_5',
          sessionId: 'sess_5',
          agentName: 'Kilo',
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
        toolOutput: {
          stdout: 'We decided to use TypeScript.',
          stderr: '',
          exitCode: 0,
        },
        extracted: {
          errors: [],
          topics: [],
        },
        filesInvolved: [],
      };

      const decisions = await extractor.extract(event);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].topic).toBe('kilocode');
    });
  });
});
