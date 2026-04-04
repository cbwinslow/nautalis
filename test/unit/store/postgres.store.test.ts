import { describe, it, expect, beforeEach, vi } from 'bun:test';
import type { Pool, PoolClient } from 'pg';
import { PostgresStore } from '@/store/postgres/store.js';
import type { Store } from '@/store/interface.js';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockConnect = vi.fn().mockReturnValue({
    query: mockQuery,
    release: vi.fn(),
  });

  return {
    Pool: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      query: mockQuery,
      on: vi.fn(),
      end: vi.fn(),
    })),
  };
});

describe('PostgresStore', () => {
  let store: PostgresStore;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock pool with proper query behavior
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const PostgresStoreCtor = vi.importActual('@/store/postgres/store.js').PostgresStore;
    store = new PostgresStoreCtor('postgresql://test:test@localhost:5432/test');
    // Replace the pool with our mock
    (store as any).pool = mockPool;
  });

  describe('initialization', () => {
    it('should check extensions on init', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { extname: 'vector' },
          { extname: 'timescaledb' },
          { extname: 'pg_trgm' },
          { extname: 'uuid-ossp' },
        ],
      });

      await store.init();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT extname FROM pg_extension'),
      );
    });

    it('should log warning if TimescaleDB not loaded', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ extname: 'vector' }, { extname: 'pg_trgm' }],
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await store.init();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TimescaleDB extension not loaded'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle init errors', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(store.init()).rejects.toThrow('Connection failed');
    });
  });

  describe('user operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // extensions check
      await store.init();
    });

    describe('createUser', () => {
      it('should create a user with all fields', async () => {
        const mockResult = {
          rows: [
            {
              id: 'user_123',
              email: 'test@example.com',
              name: 'Test User',
              auth_id: 'auth_123',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
        mockClient.query.mockResolvedValueOnce(mockResult);

        const user = await store.createUser({
          email: 'test@example.com',
          name: 'Test User',
          authId: 'auth_123',
        });

        expect(user).toEqual(mockResult.rows[0]);
        expect(mockClient.query).toHaveBeenCalledWith(
          `INSERT INTO users (email, name, auth_id) VALUES ($1, $2, $3) RETURNING *`,
          ['test@example.com', 'Test User', 'auth_123'],
        );
      });

      it('should create user without optional name', async () => {
        const mockResult = { rows: [{ id: 'user_123', email: 'test@example.com' }] };
        mockClient.query.mockResolvedValueOnce(mockResult);

        await store.createUser({ email: 'test@example.com' });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['test@example.com', null, null]),
        );
      });
    });

    describe('getUser', () => {
      it('should get user by id', async () => {
        const mockUser = { id: 'user_123', email: 'test@example.com' };
        mockClient.query.mockResolvedValueOnce({ rows: [mockUser] });

        const result = await store.getUser('user_123');

        expect(result).toEqual(mockUser);
        expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [
          'user_123',
        ]);
      });

      it('should return null if user not found', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await store.getUser('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getUserByEmail', () => {
      it('should get user by email', async () => {
        const mockUser = { id: 'user_123', email: 'test@example.com' };
        mockClient.query.mockResolvedValueOnce({ rows: [mockUser] });

        const result = await store.getUserByEmail('test@example.com');

        expect(result).toEqual(mockUser);
        expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [
          'test@example.com',
        ]);
      });
    });
  });

  describe('team operations', () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // extensions check
      await store.init();
    });

    describe('createTeam', () => {
      it('should create a team and add owner as member', async () => {
        const mockTeam = {
          id: 'team_123',
          name: 'Test Team',
          slug: 'test-team',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockClient.query
          .mockResolvedValueOnce({ rows: [mockTeam] }) // team insert
          .mockResolvedValueOnce({ rows: [] }) // team member insert
          .mockResolvedValueOnce({}); // commit

        const result = await store.createTeam({
          name: 'Test Team',
          slug: 'test-team',
          ownerId: 'owner_123',
        });

        expect(result).toEqual(mockTeam);
        expect(mockClient.query).toHaveBeenCalledWith(
          `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [mockTeam.id, 'owner_123'],
        );
      });

      it('should rollback on error', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ id: 'team_123', name: 'Test Team' }] })
          .mockRejectedValueOnce(new Error('Insert failed'));

        await expect(
          store.createTeam({ name: 'Test Team', slug: 'test-team', ownerId: 'owner_123' }),
        ).rejects.toThrow('Insert failed');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('getTeam', () => {
      it('should get team by id', async () => {
        const mockTeam = { id: 'team_123', name: 'Test Team' };
        mockClient.query.mockResolvedValueOnce({ rows: [mockTeam] });

        const result = await store.getTeam('team_123');

        expect(result).toEqual(mockTeam);
      });

      it('should return null if team not found', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const result = await store.getTeam('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getTeamBySlug', () => {
      it('should get team by slug', async () => {
        const mockTeam = { id: 'team_123', slug: 'test-slug' };
        mockClient.query.mockResolvedValueOnce({ rows: [mockTeam] });

        const result = await store.getTeamBySlug('test-slug');

        expect(result).toEqual(mockTeam);
        expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM teams WHERE slug = $1', [
          'test-slug',
        ]);
      });
    });

    describe('getTeamsForUser', () => {
      it('should get all teams for a user', async () => {
        const mockTeams = [
          { id: 'team_1', name: 'Team 1' },
          { id: 'team_2', name: 'Team 2' },
        ];
        mockClient.query.mockResolvedValueOnce({ rows: mockTeams });

        const result = await store.getTeamsForUser('user_123');

        expect(result).toEqual(mockTeams);
        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT t.* FROM teams t'),
          ['user_123'],
        );
      });
    });
  });

  describe('close', () => {
    it('should close the pool', async () => {
      await store.close();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
