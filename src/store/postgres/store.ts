import pg from 'pg';
import type { Store } from '../interface.js';
import type { NautalisEvent } from '../../types/event.js';
import type { Memory, MemoryQuery, MemoryQueryResult } from '../../types/memory.js';
import type { Team, TeamMember } from '../../types/team.js';
import { createSpan, recordMetric, logMessage } from '../../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../../types/telemetry.js';
import { v4 as uuidv4 } from 'uuid';
import { PermissionManager } from './permissions.js';
import { KnowledgeBaseEngine } from './knowledge-base.js';
import { NautalisEventSchema, MemorySchema } from '../../validation/schemas.js';
import { withRetry, RetryConfig, DEFAULT_RETRY_CONFIG } from '../../utils/resilience.js';

const { Pool } = pg;

export class PostgresStore implements Store {
  private pool: pg.Pool;
  private permissionManager: PermissionManager;
  private kbEngine: KnowledgeBaseEngine;
  private retryConfig: RetryConfig;

  constructor(connectionString: string, retryConfig?: RetryConfig) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.permissionManager = new PermissionManager(this.pool);
    this.kbEngine = new KnowledgeBaseEngine(this.pool);
    this.retryConfig = retryConfig || DEFAULT_RETRY_CONFIG;

    this.pool.on('error', (err) => {
      logMessage('error', `Unexpected PostgreSQL error: ${err.message}`);
    });
  }

  // Determine if an error is retryable
  private isRetryableError(error: any): boolean {
    if (!error || !error.code) return false;
    
    // PostgreSQL error codes that are safe to retry
    const retryableCodes = [
      '57P03', // admin_shutdown
      '57P04', // cluster_configuration_error
      '40001', // serialization_failure (deadlock)
      '40P01', // deadlock_detected
      '53300', // too_many_connections
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '08P01', // protocol_violation
    ];
    
    return retryableCodes.includes(error.code);
  }

  // Execute a function with retry for transient errors
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (!this.isRetryableError(error) || attempt >= this.retryConfig.maxAttempts - 1) {
          throw error;
        }
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffFactor, attempt) + Math.random() * 100,
          this.retryConfig.maxDelayMs,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Operation failed after retries');
  }

  // Connect to pool with retry
  private async connectWithRetry(): Promise<pg.PoolClient> {
    return this.executeWithRetry(() => this.pool.connect());
  }

  // Execute query with retry (for standalone queries outside transactions)
  private async queryWithRetry(query: string, params?: any[]): Promise<pg.QueryResult> {
    return this.executeWithRetry(() => this.pool.query(query, params));
  }

   async init(): Promise<void> {
    const span = createSpan(SPAN_NAMES.STORE_MEMORY + '.init', { db_driver: 'postgres' });
    try {
      const client = await this.connectWithRetry();
      try {
        const extensions = await client.query(`
          SELECT extname FROM pg_extension
          WHERE extname IN ('vector', 'timescaledb', 'pg_trgm', 'uuid-ossp')
        `);
        const loaded = extensions.rows.map(r => r.extname);
        logMessage('info', `PostgreSQL extensions loaded: ${loaded.join(', ')}`);

        if (!loaded.includes('timescaledb')) {
          logMessage('warn', 'TimescaleDB extension not loaded — time-series features disabled');
        }
        if (!loaded.includes('vector')) {
          logMessage('warn', 'pgvector extension not loaded — vector search disabled');
        }
      } finally {
        client.release();
      }
      span.end();
      logMessage('info', 'PostgreSQL store initialized');
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

   async close(): Promise<void> {
     await this.pool.end();
   }

    // Helper: Execute operation with team context and permission check, with retry for transient errors
    private async withTeamContext<T>(
      teamId: string,
      userId: string,
      scope: string,
      action: string,
      fn: (client: any) => Promise<T>,
    ): Promise<T> {
      const span = createSpan(SPAN_NAMES.STORE_PERMISSION, {
        'permission.userId': userId,
        'permission.teamId': teamId,
        'permission.scope': scope,
        'permission.action': action,
      });

      let lastError: Error | undefined;
      let attempt = 0;

      while (attempt < this.retryConfig.maxAttempts) {
        try {
          const client = await this.pool.connect();
          try {
            await client.query('BEGIN');
            
            // Set team context for RLS
            await client.query('SELECT set_current_team($1)', [teamId]);
            
            // Check permission
            const hasPermission = await this.permissionManager.check(userId, teamId, scope, action);
            if (!hasPermission) {
              throw new Error(`Permission denied: user ${userId} cannot ${action} ${scope} in team ${teamId}`);
            }

            const result = await fn(client);
            await client.query('COMMIT');
            span.end();
            return result;
          } catch (error) {
            await client.query('ROLLBACK');
            // Only retry on transient errors
            if (this.isRetryableError(error) && attempt < this.retryConfig.maxAttempts - 1) {
              lastError = error as Error;
              const delay = Math.min(
                this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffFactor, attempt) + Math.random() * 100,
                this.retryConfig.maxDelayMs,
              );
              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
              continue;
            }
            throw error;
          } finally {
            client.release();
          }
        } catch (error) {
          // Connection errors
          if (this.isRetryableError(error) && attempt < this.retryConfig.maxAttempts - 1) {
            lastError = error as Error;
            const delay = Math.min(
              this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffFactor, attempt) + Math.random() * 100,
              this.retryConfig.maxDelayMs,
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }
          span.end(error as Error);
          throw error;
        }
      }

      // Should not reach here, but for completeness
      throw lastError || new Error('Transaction failed after retries');
    }

   // Users
  async createUser(user: { email: string; name?: string; authId?: string }) {
    const result = await this.pool.query(
      `INSERT INTO users (email, name, auth_id) VALUES ($1, $2, $3) RETURNING *`,
      [user.email, user.name || null, user.authId || null]
    );
    return result.rows[0];
  }

  async getUser(id: string) {
    const result = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string) {
    const result = await this.pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] || null;
  }

  // Teams
    async createTeam(team: { name: string; slug: string; ownerId: string }) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        const teamResult = await client.query(
          `INSERT INTO teams (name, slug) VALUES ($1, $2) RETURNING *`,
          [team.name, team.slug]
        );
        const newTeam = this.rowToTeam(teamResult.rows[0]);

        // Audit log for team creation
        await client.query(
          `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, new_values, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [newTeam.id, team.ownerId, 'create', 'team', newTeam.id, JSON.stringify(newTeam)]
        );

        const memberResult = await client.query(
          `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner') RETURNING *`,
          [newTeam.id, team.ownerId]
        );
        const newMember = this.rowToTeamMember(memberResult.rows[0]);

        // Audit log for adding owner as team member
        await client.query(
          `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, new_values, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [newTeam.id, team.ownerId, 'add', 'team_member', `${newTeam.id}:${team.ownerId}`, JSON.stringify(newMember)]
        );

        await client.query('COMMIT');
        return newTeam;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

   async getTeam(id: string, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for getTeam');
     }

     return await this.withTeamContext<Team | null>(
       id,
       options.userId,
       'team',
       'read',
       async (client) => {
         // Verify team exists
         const result = await client.query(`SELECT * FROM teams WHERE id = $1`, [id]);
         return result.rows[0] || null;
       },
     );
   }

  async getTeamBySlug(slug: string) {
    const result = await this.pool.query(`SELECT * FROM teams WHERE slug = $1`, [slug]);
    return result.rows[0] || null;
  }

  async getTeamsForUser(userId: string) {
    const result = await this.pool.query(
      `SELECT t.* FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND tm.is_active = true
       ORDER BY t.name`,
      [userId]
    );
    return result.rows;
  }

    async updateTeam(id: string, updates: Partial<any>, options?: { userId?: string }) {
      if (!options?.userId) {
        throw new Error('userId is required for updateTeam');
      }

      const fields = Object.keys(updates).filter(k => k !== 'id');
      if (fields.length === 0) return;

      return await this.withTeamContext<void>(
        id,
        options.userId,
        'team',
        'write',
        async (client) => {
          // Fetch old team data for audit
          const oldResult = await client.query(`SELECT * FROM teams WHERE id = $1`, [id]);
          const oldTeam = oldResult.rows[0] || null;

          const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
          const values = [id, ...fields.map(f => updates[f])];

          const result = await client.query(
            `UPDATE teams SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            values
          );
          const newTeam = result.rows[0];

          // Audit log
          if (oldTeam) {
            await client.query(
              `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
              [id, options.userId, 'update', 'team', id, JSON.stringify(oldTeam), JSON.stringify(newTeam)]
            );
          }
        },
      );
    }

   // Team Members
    async addTeamMember(teamId: string, userId: string, role: string, options?: { actingUserId?: string }) {
      const actingUserId = options?.actingUserId || userId;
      if (!actingUserId) {
        throw new Error('actingUserId is required for addTeamMember');
      }

      return await this.withTeamContext<TeamMember>(
        teamId,
        actingUserId,
        'team',
        'write',
        async (client) => {
          // Fetch existing membership for audit
          const oldResult = await client.query(
            `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
          );
          const oldMember = oldResult.rows[0] || null;

           const result = await client.query(
             `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
              ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3, is_active = true, updated_at = NOW()
              RETURNING *`,
             [teamId, userId, role]
           );
           const newMember = this.rowToTeamMember(result.rows[0]);

          // Audit log
          const action = oldMember ? 'update' : 'add';
          await client.query(
            `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              teamId,
              actingUserId,
              action,
              'team_member',
              `${teamId}:${userId}`,
              oldMember ? JSON.stringify(oldMember) : null,
              JSON.stringify(newMember),
            ]
          );

          return newMember;
        },
      );
    }

    async removeTeamMember(teamId: string, userId: string, options?: { actingUserId?: string }) {
      const actingUserId = options?.actingUserId || userId;
      if (!actingUserId) {
        throw new Error('actingUserId is required for removeTeamMember');
      }

      return await this.withTeamContext<void>(
        teamId,
        actingUserId,
        'team',
        'write',
        async (client) => {
          // Fetch current membership for audit
          const oldResult = await client.query(
            `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
          );
          const oldMember = oldResult.rows[0] || null;

          await client.query(
            `UPDATE team_members SET is_active = false, updated_at = NOW() WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
          );

          // Audit log
          if (oldMember) {
            await client.query(
              `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [teamId, actingUserId, 'remove', 'team_member', `${teamId}:${userId}`, JSON.stringify(oldMember)]
            );
          }
        },
      );
    }

    async updateMemberRole(teamId: string, userId: string, role: string, options?: { actingUserId?: string }) {
      const actingUserId = options?.actingUserId || userId;
      if (!actingUserId) {
        throw new Error('actingUserId is required for updateMemberRole');
      }

      return await this.withTeamContext<void>(
        teamId,
        actingUserId,
        'team',
        'write',
        async (client) => {
          // Fetch current membership for audit
          const oldResult = await client.query(
            `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
          );
          const oldMember = oldResult.rows[0] || null;

          await client.query(
            `UPDATE team_members SET role = $3, updated_at = NOW() WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId, role]
          );

          // Audit log
          if (oldMember && oldMember.role !== role) {
            const newMember = { ...oldMember, role };
            await client.query(
              `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
              [teamId, actingUserId, 'update', 'team_member', `${teamId}:${userId}`, JSON.stringify(oldMember), JSON.stringify(newMember)]
            );
          }
        },
      );
    }

   async getTeamMembers(teamId: string, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for getTeamMembers');
     }

     return await this.withTeamContext<TeamMember[]>(
       teamId,
       options.userId,
       'team',
       'read',
       async (client) => {
         const result = await client.query(
           `SELECT tm.*, u.email, u.name FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND tm.is_active = true
            ORDER BY tm.role, u.name`,
           [teamId]
         );
         return result.rows;
       },
     );
   }

  // Permissions
  async checkPermission(userId: string, teamId: string, scope: string, action: string): Promise<boolean> {
    return this.permissionManager.check(userId, teamId, scope, action);
  }

  async grantPermission(teamId: string, userId: string, scope: string, action: string, granted: boolean) {
    await this.permissionManager.grant(teamId, userId, scope, action, granted);
  }

  async shareResource(teamId: string, resourceType: string, resourceId: string, targetUserId: string, actions: string[]) {
    await this.pool.query(
      `INSERT INTO resource_shares (team_id, resource_type, resource_id, user_id, actions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, user_id, resource_type, resource_id) DO UPDATE SET actions = $5, updated_at = NOW()`,
      [teamId, resourceType, resourceId, targetUserId, actions]
    );
  }

   // Projects
   async createProject(project: { teamId: string; name: string; slug?: string; repoPath?: string; repoUrl?: string }, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for createProject');
     }

     return await this.withTeamContext<string>(
       project.teamId,
       options.userId,
       'project',
       'write',
       async (client) => {
         const result = await client.query(
           `INSERT INTO projects (team_id, name, slug, repo_path, repo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
           [project.teamId, project.name, project.slug || null, project.repoPath || null, project.repoUrl || null]
         );
         return result.rows[0].id;
       },
     );
   }

   async getProject(id: string, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for getProject');
     }

     // Get project's teamId
     const result = await this.pool.query(`SELECT team_id FROM projects WHERE id = $1`, [id]);
     if (!result.rows[0]) return null;
     const teamId = result.rows[0].team_id;

     return await this.withTeamContext<any>(
       teamId,
       options.userId,
       'project',
       'read',
       async (client) => {
         const within = await client.query(`SELECT * FROM projects WHERE id = $1`, [id]);
         return within.rows[0] || null;
       },
     );
   }

   async getProjectsForTeam(teamId: string, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for getProjectsForTeam');
     }

     return await this.withTeamContext<any[]>(
       teamId,
       options.userId,
       'project',
       'read',
       async (client) => {
         const result = await client.query(
           `SELECT * FROM projects WHERE team_id = $1 AND is_active = true ORDER BY name`,
           [teamId]
         );
         return result.rows;
       },
     );
   }

   // Agents
   async upsertAgent(agent: { teamId: string; userId?: string; projectId?: string; toolName: string; toolVersion?: string; instanceId: string; agentName?: string }, options?: { userId?: string }) {
     const actingUserId = options?.userId || agent.userId;
     if (!actingUserId) {
       throw new Error('userId is required for upsertAgent (provide as option or agent.userId)');
     }

     return await this.withTeamContext<string>(
       agent.teamId,
       actingUserId,
       'agent',
       'write',
       async (client) => {
         const result = await client.query(
           `INSERT INTO agents (team_id, user_id, project_id, tool_name, tool_version, instance_id, agent_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (team_id, instance_id) DO UPDATE SET
              tool_version = $5, agent_name = $7, last_seen_at = NOW(), updated_at = NOW()
            RETURNING id`,
           [agent.teamId, agent.userId || null, agent.projectId || null, agent.toolName, agent.toolVersion || null, agent.instanceId, agent.agentName || null]
         );
         return result.rows[0].id;
       },
     );
   }

   async getAgentsForTeam(teamId: string, options?: { userId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for getAgentsForTeam');
     }

     return await this.withTeamContext<any[]>(
       teamId,
       options.userId,
       'agent',
       'read',
       async (client) => {
         const result = await client.query(
           `SELECT * FROM agents WHERE team_id = $1 AND is_active = true ORDER BY last_seen_at DESC`,
           [teamId]
         );
         return result.rows;
       },
     );
   }

   // Sessions
   async createSession(session: { id: string; agentId: string; teamId: string; projectId?: string; userId?: string; branch?: string }, options?: { userId?: string }) {
     const actingUserId = options?.userId || session.userId;
     if (!actingUserId) {
       throw new Error('userId is required for createSession (provide as option or session.userId)');
     }

     return await this.withTeamContext<void>(
       session.teamId,
       actingUserId,
       'session',
       'write',
       async (client) => {
         await client.query(
           `INSERT INTO sessions (id, agent_id, team_id, project_id, user_id, branch, started_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
           [session.id, session.agentId, session.teamId, session.projectId || null, session.userId || null, session.branch || null]
         );
       },
     );
   }

   async updateSession(id: string, updates: { endedAt?: Date; summary?: string; status?: string; eventCount?: number }, options?: { userId?: string; teamId?: string }) {
     if (!options?.userId) {
       throw new Error('userId is required for updateSession');
     }
     if (!options?.teamId) {
       throw new Error('teamId is required for updateSession');
     }

     return await this.withTeamContext<void>(
       options.teamId,
       options.userId,
       'session',
       'write',
       async (client) => {
         const parts: string[] = [];
         const params: any[] = [];
         let idx = 1;

         if (updates.endedAt) { parts.push(`ended_at = $${idx++}`); params.push(updates.endedAt); }
         if (updates.summary) { parts.push(`summary = $${idx++}`); params.push(updates.summary); }
         if (updates.status) { parts.push(`status = $${idx++}`); params.push(updates.status); }
         if (updates.eventCount !== undefined) { parts.push(`event_count = $${idx++}`); params.push(updates.eventCount); }

         if (parts.length === 0) return;

         parts.push(`updated_at = NOW()`);
         params.push(id);
         const sql = `UPDATE sessions SET ${parts.join(', ')} WHERE id = $${idx} AND team_id = $${idx+1}`;
         params.push(options.teamId);
         await client.query(sql, params);
       },
     );
   }

   // Events
  async insertEvent(event: NautalisEvent): Promise<string> {
    const span = createSpan(SPAN_NAMES.INGEST_EVENT, {
      'event.type': event.type,
      'event.tool': event.toolName || 'unknown',
    });

    try {
      // Validate event input
      NautalisEventSchema.parse(event);

      const id = event.eventId || uuidv4();

      await this.pool.query(
        `INSERT INTO events (id, team_id, session_id, agent_id, project_id, user_id,
          event_type, tool_name, tool_input, tool_output, files_involved, exit_code,
          decisions, errors, topics, raw, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          event.context.teamId || '',
          event.source.sessionId || null,
          null,
          event.context.projectId || null,
          event.source.userId || null,
          event.type,
          event.toolName || null,
          event.toolInput ? JSON.stringify(event.toolInput) : null,
          event.toolOutput ? JSON.stringify(event.toolOutput) : null,
          event.filesInvolved,
          event.toolOutput?.exitCode ?? null,
          event.extracted.decisions,
          event.extracted.errors,
          event.extracted.topics,
          event.raw ? JSON.stringify(event.raw) : null,
          event.timestamp,
        ]
      );

      span.end();
      recordMetric(METRIC_NAMES.EVENTS_INGESTED, 1, { tool: event.source.toolName });
      return id;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

  async getEventsBySession(sessionId: string, limit = 100) {
    const result = await this.queryWithRetry(
      `SELECT * FROM events WHERE session_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [sessionId, limit]
    );
    return result.rows.map(this.rowToEvent);
  }

   async getEventsByTeam(teamId: string, options?: { since?: Date; until?: Date; type?: string; limit?: number }) {
     let sql = `SELECT * FROM events WHERE team_id = $1`;
     const params: any[] = [teamId];
     let idx = 2;

     if (options?.since) { sql += ` AND timestamp >= $${idx++}`; params.push(options.since); }
     if (options?.until) { sql += ` AND timestamp <= $${idx++}`; params.push(options.until); }
     if (options?.type) { sql += ` AND event_type = $${idx++}`; params.push(options.type); }

     sql += ` ORDER BY timestamp DESC LIMIT $${idx++}`;
     params.push(options?.limit || 100);

     const result = await this.queryWithRetry(sql, params);
     return result.rows.map(this.rowToEvent);
   }

   // Memories
   async insertMemory(memory: Memory, options?: { userId?: string; teamId?: string }): Promise<string> {
     const span = createSpan(SPAN_NAMES.STORE_MEMORY, {
       'memory.type': memory.classification.memoryType,
     });

     // Determine userId and teamId for permission check
     const effectiveUserId = options?.userId || memory.agentIdentity.userId;
     const effectiveTeamId = options?.teamId || memory.context.teamId;

      if (!effectiveTeamId) {
        throw new Error('teamId is required for insertMemory');
      }
      if (!effectiveUserId) {
        throw new Error('userId is required for insertMemory');
      }

      // Validate memory object
      MemorySchema.parse(memory);

      return await this.withTeamContext<string>(
       effectiveTeamId,
       effectiveUserId,
       'memory',
       'write', // insert counts as write
       async (client) => {
         const id = memory.id || uuidv4();

         await client.query(
           `INSERT INTO memories (
             id, team_id, agent_id, session_id, project_id, user_id,
             memory_type, block_label, topics, confidence, importance, sensitivity,
             summary, detail, files_involved, commands_exec, errors_seen, code_snippets,
             parent_memory_id, supersedes, contradicts, supports, tags,
             ttl, decay_rate, is_stale,
             repo_path, repo_url, branch, cwd
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
             $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
           )`,
           [
             id,
             effectiveTeamId,
             null,
             memory.agentIdentity.sessionId || null,
             memory.context.projectId || null,
             effectiveUserId,
             memory.classification.memoryType,
             memory.classification.blockLabel || null,
             memory.classification.topics,
             memory.classification.confidence,
             memory.classification.importance,
             memory.classification.sensitivity,
             memory.content.summary,
             memory.content.detail || null,
             memory.content.filesInvolved,
             memory.content.commandsExec,
             memory.content.errorsSeen,
             memory.content.codeSnippets,
             memory.relationships.parentMemoryId || null,
             memory.relationships.supersedes,
             memory.relationships.contradicts,
             memory.relationships.supports,
             memory.relationships.tags,
             memory.lifecycle.ttl || null,
             memory.lifecycle.decayRate,
             memory.lifecycle.isStale,
             memory.context.repoPath || null,
             memory.context.repoUrl || null,
             memory.context.branch || null,
             memory.context.cwd,
           ]
         );

         if (memory.embedding) {
           await client.query(
             `INSERT INTO memory_embeddings (memory_id, embedding) VALUES ($1, $2::vector)
              ON CONFLICT (memory_id) DO UPDATE SET embedding = $2::vector`,
             [id, `[${memory.embedding.join(',')}]`]
           );
         }

         recordMetric(METRIC_NAMES.MEMORIES_STORED, 1);
         span.end();
         return id;
       },
     );
   }

   async getMemory(id: string, options?: { userId?: string; teamId?: string }) {
     if (!options?.teamId) {
       throw new Error('teamId is required for getMemory');
     }
     if (!options?.userId) {
       throw new Error('userId is required for getMemory');
     }

     return await this.withTeamContext<Memory | null>(
       options.teamId,
       options.userId,
       'memory',
       'read',
       async (client) => {
         const result = await client.query(
           `SELECT * FROM memories WHERE id = $1 AND team_id = $2`,
           [id, options.teamId]
         );
         if (!result.rows[0]) return null;

         // Update access tracking within same transaction
         await client.query(
           `UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = $1`,
           [id]
         );

         return this.rowToMemory(result.rows[0]);
       },
     );
   }

   async queryMemories(query: MemoryQuery & { teamId?: string; userId?: string }): Promise<MemoryQueryResult[]> {
     const span = createSpan(SPAN_NAMES.QUERY_MEMORY, {
       'query.text': query.query,
     });

     if (!query.teamId) {
       throw new Error('teamId is required for queryMemories');
     }
     if (!query.userId) {
       throw new Error('userId is required for queryMemories');
     }

     try {
       return await this.withTeamContext<MemoryQueryResult[]>(
         query.teamId,
         query.userId,
         'memory',
         'read',
         async (client) => {
           let sql = `SELECT * FROM memories WHERE team_id = $1`;
           const params: any[] = [query.teamId];
           let idx = 2;

           if (query.projectId) { sql += ` AND project_id = $${idx++}`; params.push(query.projectId); }
           if (query.memoryType) { sql += ` AND memory_type = $${idx++}`; params.push(query.memoryType); }
           if (query.minImportance !== undefined) { sql += ` AND importance >= $${idx++}`; params.push(query.minImportance); }
           if (query.dateFrom) { sql += ` AND created_at >= $${idx++}`; params.push(query.dateFrom); }
           if (query.dateTo) { sql += ` AND created_at <= $${idx++}`; params.push(query.dateTo); }

           sql += ` ORDER BY importance DESC, created_at DESC LIMIT $${idx++}`;
           params.push(query.limit || 20);

           const result = await client.query(sql, params);
           const results = result.rows.map((row: any) => ({
             memory: this.rowToMemory(row),
             score: 1.0,
             matchedTopics: [],
             matchedFiles: [],
           }));

           span.end();
           return results;
         },
       );
     } catch (error) {
       span.end(error as Error);
       throw error;
     }
   }

    async updateMemory(id: string, updates: Partial<Memory>, options?: { userId?: string; teamId?: string }) {
      if (!options?.teamId) {
        throw new Error('teamId is required for updateMemory');
      }
      if (!options?.userId) {
        throw new Error('userId is required for updateMemory');
      }
      const teamId = options.teamId;
      const userId = options.userId;

      return await this.withTeamContext<void>(
        teamId,
        userId,
        'memory',
        'write',
        async (client) => {
          // Fetch existing memory for audit
          const oldResult = await client.query('SELECT * FROM memories WHERE id = $1 AND team_id = $2', [id, teamId]);
          if (oldResult.rows.length === 0) {
            throw new Error(`Memory ${id} not found`);
          }
          const oldMemory = oldResult.rows[0];

          // Build dynamic UPDATE statement
          const setClauses: string[] = [];
          const params: any[] = [];
          let idx = 1;

          // Team id cannot be updated
          if (updates.context?.teamId) {
            throw new Error('Cannot change memory teamId');
          }

          // Map of updatable fields
          if (updates.classification) {
            if (updates.classification.memoryType) { setClauses.push(`memory_type = $${idx++}`); params.push(updates.classification.memoryType); }
            if (updates.classification.blockLabel !== undefined) { setClauses.push(`block_label = $${idx++}`); params.push(updates.classification.blockLabel); }
            if (updates.classification.topics) { setClauses.push(`topics = $${idx++}`); params.push(updates.classification.topics); }
            if (updates.classification.confidence !== undefined) { setClauses.push(`confidence = $${idx++}`); params.push(updates.classification.confidence); }
            if (updates.classification.importance !== undefined) { setClauses.push(`importance = $${idx++}`); params.push(updates.classification.importance); }
            if (updates.classification.sensitivity) { setClauses.push(`sensitivity = $${idx++}`); params.push(updates.classification.sensitivity); }
          }

          if (updates.content) {
            if (updates.content.summary) { setClauses.push(`summary = $${idx++}`); params.push(updates.content.summary); }
            if (updates.content.detail !== undefined) { setClauses.push(`detail = $${idx++}`); params.push(updates.content.detail); }
            if (updates.content.filesInvolved) { setClauses.push(`files_involved = $${idx++}`); params.push(updates.content.filesInvolved); }
            if (updates.content.commandsExec) { setClauses.push(`commands_exec = $${idx++}`); params.push(updates.content.commandsExec); }
            if (updates.content.errorsSeen) { setClauses.push(`errors_seen = $${idx++}`); params.push(updates.content.errorsSeen); }
            if (updates.content.codeSnippets) { setClauses.push(`code_snippets = $${idx++}`); params.push(updates.content.codeSnippets); }
          }

          if (updates.relationships) {
            if (updates.relationships.parentMemoryId !== undefined) { setClauses.push(`parent_memory_id = $${idx++}`); params.push(updates.relationships.parentMemoryId); }
            if (updates.relationships.supersedes) { setClauses.push(`supersedes = $${idx++}`); params.push(updates.relationships.supersedes); }
            if (updates.relationships.contradicts) { setClauses.push(`contradicts = $${idx++}`); params.push(updates.relationships.contradicts); }
            if (updates.relationships.supports) { setClauses.push(`supports = $${idx++}`); params.push(updates.relationships.supports); }
            if (updates.relationships.tags) { setClauses.push(`tags = $${idx++}`); params.push(updates.relationships.tags); }
          }

          if (updates.lifecycle) {
            if (updates.lifecycle.ttl !== undefined) { setClauses.push(`ttl = $${idx++}`); params.push(updates.lifecycle.ttl); }
            if (updates.lifecycle.decayRate !== undefined) { setClauses.push(`decay_rate = $${idx++}`); params.push(updates.lifecycle.decayRate); }
            if (updates.lifecycle.isStale !== undefined) { setClauses.push(`is_stale = $${idx++}`); params.push(updates.lifecycle.isStale); }
          }

          if (updates.context) {
            if (updates.context.projectId !== undefined) { setClauses.push(`project_id = $${idx++}`); params.push(updates.context.projectId); }
            if (updates.context.repoPath !== undefined) { setClauses.push(`repo_path = $${idx++}`); params.push(updates.context.repoPath); }
            if (updates.context.repoUrl !== undefined) { setClauses.push(`repo_url = $${idx++}`); params.push(updates.context.repoUrl); }
            if (updates.context.branch !== undefined) { setClauses.push(`branch = $${idx++}`); params.push(updates.context.branch); }
            if (updates.context.cwd !== undefined) { setClauses.push(`cwd = $${idx++}`); params.push(updates.context.cwd); }
          }

          if (setClauses.length === 0) {
            throw new Error('No updates provided');
          }

          setClauses.push(`updated_at = NOW()`);

          params.push(id, teamId);
          const sql = `UPDATE memories SET ${setClauses.join(', ')} WHERE id = $${idx++} AND team_id = $${idx++} RETURNING *`;

          const result = await client.query(sql, params);
          const newMemory = result.rows[0];

          // Audit log using the same client (within transaction)
          await this.logAudit(teamId, userId, 'update', 'memory', id, { oldValues: oldMemory, newValues: newMemory }, client);
        },
      );
    }

    async deleteMemory(id: string, options?: { userId?: string; teamId?: string }): Promise<void> {
      if (!options?.teamId) {
        throw new Error('teamId is required for deleteMemory');
      }
      if (!options?.userId) {
        throw new Error('userId is required for deleteMemory');
      }
      const teamId = options.teamId;
      const userId = options.userId;

      return await this.withTeamContext<void>(
        teamId,
        userId,
        'memory',
        'delete',
        async (client) => {
          // Fetch existing memory for audit
          const oldResult = await client.query('SELECT * FROM memories WHERE id = $1 AND team_id = $2', [id, teamId]);
          if (oldResult.rows.length === 0) {
            throw new Error(`Memory ${id} not found`);
          }
          const oldMemory = oldResult.rows[0];

          // Delete
          await client.query('DELETE FROM memories WHERE id = $1 AND team_id = $2', [id, teamId]);

          // Audit log using the same client (within transaction)
          await this.logAudit(teamId, userId, 'delete', 'memory', id, { oldValues: oldMemory }, client);
        },
      );
     }

    // Old duplicate removed — use the version with options above

   async listMemories(teamId: string, filters?: { projectId?: string; memoryType?: string; limit?: number; userId?: string }) {
     if (!filters?.userId) {
       throw new Error('userId is required for listMemories');
     }

     return await this.withTeamContext<Memory[]>(
       teamId,
       filters.userId,
       'memory',
       'read',
       async (client) => {
         let sql = `SELECT * FROM memories WHERE team_id = $1`;
         const params: any[] = [teamId];
         let idx = 2;

         if (filters?.projectId) { sql += ` AND project_id = $${idx++}`; params.push(filters.projectId); }
         if (filters?.memoryType) { sql += ` AND memory_type = $${idx++}`; params.push(filters.memoryType); }

         sql += ` ORDER BY importance DESC, created_at DESC LIMIT $${idx++}`;
         params.push(filters?.limit || 50);

         const result = await client.query(sql, params);
         return result.rows.map(this.rowToMemory);
       },
     );
   }

    async findSimilarMemories(embedding: number[], teamId: string, limit = 10, minScore = 0.7, options?: { userId?: string }) {
      if (!options?.userId) {
        throw new Error('userId is required for findSimilarMemories');
      }

      return await this.withTeamContext<MemoryQueryResult[]>(
        teamId,
        options.userId,
        'memory',
        'read',
        async (client) => {
          const result = await client.query(
            `SELECT m.*, 1 - (me.embedding <=> $1::vector) AS similarity
             FROM memory_embeddings me
             JOIN memories m ON m.id = me.memory_id
             WHERE m.team_id = $2 AND m.is_stale = false
             AND 1 - (me.embedding <=> $1::vector) >= $3
             ORDER BY me.embedding <=> $1::vector
             LIMIT $4`,
            [`[${embedding.join(',')}]`, teamId, minScore, limit]
          );

          return result.rows.map((row: any) => ({
            memory: this.rowToMemory(row),
            score: row.similarity,
            matchedTopics: [],
            matchedFiles: [],
          }));
        },
      );
    }

     async getMemoriesByIds(ids: string[], options: { teamId: string; userId?: string }) {
       if (!options.userId) {
         throw new Error('userId is required for getMemoriesByIds');
       }

       return await this.withTeamContext<Memory[]>(
         options.teamId,
         options.userId,
         'memory',
         'read',
         async (client) => {
           const result = await client.query(
             `SELECT * FROM memories WHERE id = ANY($1) AND team_id = $2`,
             [ids, options.teamId]
           );
           return result.rows.map((row: any) => this.rowToMemory(row));
         },
       );
     }

    // Relationships
    async getRelatedMemories(
      memoryId: string,
      relationType: 'parent' | 'child' | 'supersedes' | 'supersededBy' | 'contradicts' | 'contradictedBy' | 'supports' | 'supportedBy' | 'all',
      options: { teamId: string; userId?: string }
    ): Promise<Memory[]> {
      if (!options.userId) {
        throw new Error('userId is required for getRelatedMemories');
      }

      return await this.withTeamContext<Memory[]>(
        options.teamId,
        options.userId,
        'memory',
        'read',
        async (client) => {
          let query: string;
          let queryParams: any[] = [];

          switch (relationType) {
            case 'parent':
              query = `SELECT * FROM memories WHERE id = (SELECT parent_memory_id FROM memories WHERE id = $1) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'child':
              query = `SELECT * FROM memories WHERE parent_memory_id = $1 AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'supersedes':
              query = `SELECT * FROM memories WHERE id = ANY((SELECT supersedes FROM memories WHERE id = $1)) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'supersededBy':
              query = `SELECT * FROM memories WHERE $1 = ANY(supersedes) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'contradicts':
              query = `SELECT * FROM memories WHERE id = ANY((SELECT contradicts FROM memories WHERE id = $1)) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'contradictedBy':
              query = `SELECT * FROM memories WHERE $1 = ANY(contradicts) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'supports':
              query = `SELECT * FROM memories WHERE id = ANY((SELECT supports FROM memories WHERE id = $1)) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'supportedBy':
              query = `SELECT * FROM memories WHERE $1 = ANY(supports) AND team_id = $2`;
              queryParams = [memoryId, options.teamId];
              break;
            case 'all':
              query = `
                SELECT * FROM memories WHERE
                  id = (SELECT parent_memory_id FROM memories WHERE id = $1)
                  OR parent_memory_id = $1
                  OR $1 = ANY(supersedes)
                  OR id = ANY((SELECT supersedes FROM memories WHERE id = $1))
                  OR $1 = ANY(contradicts)
                  OR id = ANY((SELECT contradicts FROM memories WHERE id = $1))
                  OR $1 = ANY(supports)
                  OR id = ANY((SELECT supports FROM memories WHERE id = $1))
                AND team_id = $2
              `;
              queryParams = [memoryId, options.teamId];
              break;
            default:
              const _exhaustive: never = relationType;
              return [];
          }

          const result = await client.query(query, queryParams);
          return result.rows.map((row: any) => this.rowToMemory(row));
        },
      );
    }

    async insertEmbedding(memoryId: string, embedding: number[]) {
      await this.pool.query(
        `INSERT INTO memory_embeddings (memory_id, embedding) VALUES ($1, $2::vector)
         ON CONFLICT (memory_id) DO UPDATE SET embedding = $2::vector`,
        [memoryId, `[${embedding.join(',')}]`]
      );
    }

    // Full-text search for memories
    async fullTextSearchMemories(teamId: string, query: string, limit = 10, options?: { userId?: string }) {
      if (!options?.userId) {
        throw new Error('userId is required for fullTextSearchMemories');
      }

      return await this.withTeamContext<{ memory: Memory; score: number }[]>(
        teamId,
        options.userId,
        'memory',
        'read',
        async (client) => {
          const result = await client.query(
            `SELECT m.*, ts_rank(to_tsvector('english', m.summary || ' ' || m.detail), plainto_tsquery('english', $1)) AS rank
             FROM memories m
             WHERE m.team_id = $2 AND m.is_stale = false
               AND to_tsvector('english', m.summary || ' ' || m.detail) @@ plainto_tsquery('english', $1)
             ORDER BY rank DESC
             LIMIT $3`,
            [query, teamId, limit]
          );
          return result.rows.map((row: any) => ({
            memory: this.rowToMemory(row),
            score: row.rank,
          }));
        },
      );
    }

  // Knowledge Base (with permission enforcement)
    async createKnowledgeBase(entry: any, options?: { userId?: string }): Promise<string> {
      const userId = options?.userId || entry.createdById;
      if (!userId) throw new Error('userId is required for createKnowledgeBase');
      if (!entry.teamId) throw new Error('teamId is required for createKnowledgeBase');

      return await this.withTeamContext<string>(
        entry.teamId,
        userId,
        'knowledge_base',
        'write',
        async (client) => {
          const id = entry.id || uuidv4();
          await client.query(
            `INSERT INTO knowledge_base (id, team_id, project_id, created_by, title, content, content_type, category, tags, topics, visibility, source, source_agent_id, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              id,
              entry.teamId,
              entry.projectId || null,
              userId,
              entry.title,
              entry.content,
              entry.contentType || 'markdown',
              entry.category || null,
              entry.tags || [],
              entry.topics || [],
              entry.visibility || 'team',
              entry.source || 'manual',
              entry.sourceAgentId || null,
              entry.confidence ?? 1.0,
            ],
          );

          if (entry.embedding) {
            await client.query(
              `INSERT INTO knowledge_base_embeddings (kb_id, embedding) VALUES ($1, $2::vector)`,
              [id, `[${entry.embedding.join(',')}]`],
            );
          }

          // Audit log for creation
          const newEntry = { ...entry, id, created_by: userId };
          await this.logAudit(entry.teamId, userId, 'create', 'knowledge_base', id, { newValues: newEntry }, client);

          recordMetric(METRIC_NAMES.KNOWLEDGE_BASE_CREATED, 1);
          return id;
        },
      );
    }

   async getKnowledgeBase(id: string, options?: { userId?: string }): Promise<any> {
     if (!options?.userId) throw new Error('userId is required for getKnowledgeBase');

     // First get the entry to determine teamId
     const result = await this.pool.query(
       `SELECT * FROM knowledge_base WHERE id = $1 AND is_archived = false`,
       [id]
     );
     const entry = result.rows[0];
     if (!entry) return null;

     if (!entry.teamId) throw new Error('teamId missing from knowledge base entry');

     return await this.withTeamContext<any>(
       entry.teamId,
       options.userId,
       'knowledge_base',
       'read',
       async (client) => {
         // Re-fetch within context to respect RLS
         const withinContext = await client.query(
           `SELECT * FROM knowledge_base WHERE id = $1 AND is_archived = false`,
           [id]
         );
         return withinContext.rows[0] || null;
       },
     );
   }

   async queryKnowledgeBase(query: any & { userId?: string; teamId?: string }): Promise<any[]> {
     if (!query.teamId) throw new Error('teamId is required for queryKnowledgeBase');
     if (!query.userId) throw new Error('userId is required for queryKnowledgeBase');

     return await this.withTeamContext<any[]>(
       query.teamId,
       query.userId,
       'knowledge_base',
       'read',
       async (client) => {
         let sql = `SELECT * FROM knowledge_base WHERE team_id = $1`;
         const params: any[] = [query.teamId];
         let idx = 2;

         if (!query.includeArchived) {
           sql += ` AND is_archived = false`;
         }

         if (query.category) { sql += ` AND category = $${idx++}`; params.push(query.category); }
         if (query.visibility) { sql += ` AND visibility = $${idx++}`; params.push(query.visibility); }
         if (query.projectId) { sql += ` AND project_id = $${idx++}`; params.push(query.projectId); }
         if (query.tags && query.tags.length > 0) {
           sql += ` && $${idx++}`; params.push(query.tags);
         }

         sql += ` ORDER BY updated_at DESC LIMIT $${idx++}`;
         params.push(query.limit || 50);

         const result = await client.query(sql, params);
         return result.rows;
       },
     );
    }

    async updateKnowledgeBase(id: string, updates: any, options?: { userId?: string }): Promise<void> {
      if (!options?.userId) throw new Error('userId is required for updateKnowledgeBase');
      const userId = options.userId; // already validated

      // Get entry to determine teamId and fetch old state for audit
      const result = await this.pool.query(`SELECT team_id FROM knowledge_base WHERE id = $1`, [id]);
      if (!result.rows[0]) throw new Error('Knowledge base entry not found');
      const teamId = result.rows[0].team_id;

      // Fetch full old entry within the transaction later, but we need teamId now

      return await this.withTeamContext<void>(
        teamId,
        userId,
        'knowledge_base',
        'write',
        async (client) => {
          // Fetch old entry for audit
          const oldResult = await client.query(`SELECT * FROM knowledge_base WHERE id = $1`, [id]);
          const oldEntry = oldResult.rows[0] || null;

          const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'embedding');
          if (fields.length === 0) return;

          const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
          const values = [
            id,
            ...fields.map((f) => {
              const value = updates[f as keyof any];
              return Array.isArray(value) ? value : value;
            }),
          ];

          const result = await client.query(
            `UPDATE knowledge_base SET ${setClauses}, version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
            values,
          );
          const newEntry = result.rows[0];

          // Audit log
          if (oldEntry) {
            await this.logAudit(teamId, userId, 'update', 'knowledge_base', id, { oldValues: oldEntry, newValues: newEntry }, client);
          }
        },
      );
    }

    async deleteKnowledgeBase(id: string, options?: { userId?: string }): Promise<void> {
      if (!options?.userId) throw new Error('userId is required for deleteKnowledgeBase');
      const userId = options.userId;

      // Get entry to determine teamId and fetch full entry for audit
      const result = await this.pool.query(`SELECT team_id FROM knowledge_base WHERE id = $1`, [id]);
      if (!result.rows[0]) throw new Error('Knowledge base entry not found');
      const teamId = result.rows[0].team_id;

      return await this.withTeamContext<void>(
        teamId,
        userId,
        'knowledge_base',
        'write',
        async (client) => {
          // Fetch full entry for audit
          const oldResult = await client.query(`SELECT * FROM knowledge_base WHERE id = $1`, [id]);
          const oldEntry = oldResult.rows[0] || null;

          await client.query(`DELETE FROM knowledge_base_embeddings WHERE kb_id = $1`, [id]);
          await client.query(`DELETE FROM knowledge_base WHERE id = $1`, [id]);

          // Audit log
          if (oldEntry) {
            await this.logAudit(teamId, userId, 'delete', 'knowledge_base', id, { oldValues: oldEntry }, client);
          }
        },
      );
    }

   async searchKnowledgeBase(teamId: string, query: string, embedding?: number[], options?: { category?: string; limit?: number; userId?: string }): Promise<any[]> {
     if (!options?.userId) throw new Error('userId is required for searchKnowledgeBase');

     return await this.withTeamContext<any[]>(
       teamId,
       options.userId,
       'knowledge_base',
       'read',
       async (client) => {
         // Perform search within permission context
         if (embedding) {
           const result = await client.query(
             `SELECT kb.*, 1 - (kbe.embedding <=> $1::vector) AS similarity
              FROM knowledge_base_embeddings kbe
              JOIN knowledge_base kb ON kb.id = kbe.kb_id
              WHERE kb.team_id = $2 AND kb.is_published = true AND kb.is_archived = false
              ${options?.category ? 'AND kb.category = $3' : ''}
              ORDER BY kbe.embedding <=> $1::vector
              LIMIT $${options?.category ? 4 : 3}`,
             embedding
               ? [
                   `[${embedding.join(',')}]`,
                   teamId,
                   ...(options?.category ? [options.category] : []),
                   options?.limit || 10,
                 ]
               : [teamId, options?.limit || 10],
           );
           return result.rows;
         } else {
           const result = await client.query(
             `SELECT *, ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', $1)) AS rank
              FROM knowledge_base
              WHERE team_id = $2 AND is_published = true AND is_archived = false
              AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $1)
              ORDER BY rank DESC
              LIMIT $3`,
             [query, teamId, options?.limit || 10],
           );
           return result.rows;
         }
       },
     );
   }

  // Telemetry
  async insertTelemetry(entry: { teamId: string; signalType: string; name: string; attributes?: Record<string, unknown>; value?: number; message?: string; traceId?: string; spanId?: string; startTime: Date; endTime?: Date }) {
    await this.pool.query(
      `INSERT INTO telemetry (team_id, signal_type, name, attributes, value, message, trace_id, span_id, start_time, end_time, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [entry.teamId, entry.signalType, entry.name, entry.attributes ? JSON.stringify(entry.attributes) : null, entry.value || null, entry.message || null, entry.traceId || null, entry.spanId || null, entry.startTime, entry.endTime || null]
    );
  }

   // Audit
   async logAudit(teamId: string, userId: string, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>, client?: pg.Client) {
     const queryClient = client || this.pool;
     await queryClient.query(
       `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
       [teamId, userId, action, resourceType, resourceId || null, details?.oldValues ? JSON.stringify(details.oldValues) : null, details?.newValues ? JSON.stringify(details.newValues) : null]
     );
   }

   // Stats
   async getTeamDashboard(teamId: string) {
     const result = await this.queryWithRetry(`SELECT get_team_dashboard($1) AS dashboard`, [teamId]);
     return result.rows[0]?.dashboard || {};
   }

   async getStats() {
     const users = await this.queryWithRetry(`SELECT COUNT(*)::int FROM users`);
     const teams = await this.queryWithRetry(`SELECT COUNT(*)::int FROM teams`);
     const projects = await this.queryWithRetry(`SELECT COUNT(*)::int FROM projects`);
     const agents = await this.queryWithRetry(`SELECT COUNT(*)::int FROM agents`);
     const memories = await this.queryWithRetry(`SELECT COUNT(*)::int FROM memories`);
     const events = await this.queryWithRetry(`SELECT COUNT(*)::int FROM events`);

     return {
       totalUsers: users.rows[0].count,
       totalTeams: teams.rows[0].count,
       totalProjects: projects.rows[0].count,
       totalAgents: agents.rows[0].count,
       totalMemories: memories.rows[0].count,
       totalEvents: events.rows[0].count,
     };
    }

    // Conversion helpers
    private rowToTeam(row: any): Team {
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        avatarUrl: row.avatar_url,
        settings: row.settings || {},
        maxMembers: row.max_members,
        maxProjects: row.max_projects,
        maxStorageGb: row.max_storage_gb,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    }

    private rowToTeamMember(row: any): TeamMember {
      return {
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        role: row.role,
        invitedBy: row.invited_by,
        invitedAt: new Date(row.invited_at),
        joinedAt: new Date(row.joined_at),
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    }

    private rowToEvent(row: any): NautalisEvent {
    // Parse tool output and incorporate exit_code
    let toolOutput: any = row.tool_output ? JSON.parse(row.tool_output) : {};
    if (row.exit_code !== null && row.exit_code !== undefined) {
      toolOutput.exitCode = row.exit_code;
    }

    return {
      eventId: row.id,
      timestamp: new Date(row.timestamp),
      source: {
        toolName: row.tool_name || '',
        toolVersion: '',
        instanceId: '',
        sessionId: row.session_id || '',
        agentName: '',
        userId: row.user_id || '',
      },
      project: {
        teamId: row.team_id,
        projectId: row.project_id || '',
        repoPath: '',
        cwd: '',
        platform: '',
      },
      type: row.event_type,
      toolName: row.tool_name,
      toolInput: row.tool_input ? JSON.parse(row.tool_input) : undefined,
      toolOutput: Object.keys(toolOutput).length > 0 ? toolOutput : undefined,
      filesInvolved: row.files_involved || [],
      context: {
        teamId: row.team_id,
        projectId: row.project_id || '',
        repoPath: '',
        cwd: '',
        platform: '',
      },
      extracted: {
        decisions: row.decisions || [],
        errors: row.errors || [],
        topics: row.topics || [],
      },
      raw: row.raw || undefined,
    };
  }

  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      agentIdentity: {
        toolName: '',
        toolVersion: '',
        instanceId: '',
        sessionId: row.session_id || '',
        agentName: '',
        userId: row.user_id || '',
      },
      context: {
        teamId: row.team_id,
        projectId: row.project_id || '',
        repoPath: row.repo_path || '',
        repoUrl: row.repo_url || '',
        branch: row.branch || '',
        cwd: row.cwd || '',
        platform: '',
      },
      classification: {
        memoryType: row.memory_type,
        blockLabel: row.block_label || '',
        topics: row.topics || [],
        confidence: row.confidence,
        importance: row.importance,
        sensitivity: row.sensitivity,
      },
      content: {
        summary: row.summary,
        detail: row.detail,
        filesInvolved: row.files_involved || [],
        commandsExec: row.commands_exec || [],
        errorsSeen: row.errors_seen || [],
        codeSnippets: row.code_snippets || [],
      },
      relationships: {
        parentMemoryId: row.parent_memory_id,
        supersedes: row.supersedes || [],
        contradicts: row.contradicts || [],
        supports: row.supports || [],
        tags: row.tags || [],
      },
      lifecycle: {
        ttl: row.ttl ? new Date(row.ttl) : undefined,
        decayRate: row.decay_rate,
        lastAccess: new Date(row.last_accessed_at),
        accessCount: row.access_count,
        isStale: row.is_stale,
      },
    };
  }
}
