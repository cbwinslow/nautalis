import pg from 'pg';
import type { Store } from '../interface.js';
import type { NautalisEvent } from '../../types/event.js';
import type { Memory, MemoryQuery, MemoryQueryResult } from '../../types/memory.js';
import { createSpan, recordMetric, logMessage } from '../../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../../types/telemetry.js';
import { v4 as uuidv4 } from 'uuid';
import { PermissionManager } from './permissions.js';
import { KnowledgeBaseEngine } from './knowledge-base.js';

const { Pool } = pg;

export class PostgresStore implements Store {
  private pool: pg.Pool;
  private permissionManager: PermissionManager;
  private kbEngine: KnowledgeBaseEngine;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.permissionManager = new PermissionManager(this.pool);
    this.kbEngine = new KnowledgeBaseEngine(this.pool);

    this.pool.on('error', (err) => {
      logMessage('error', `Unexpected PostgreSQL error: ${err.message}`);
    });
  }

  async init(): Promise<void> {
    const span = createSpan(SPAN_NAMES.STORE_MEMORY + '.init', { db_driver: 'postgres' });
    try {
      const client = await this.pool.connect();
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
      const newTeam = teamResult.rows[0];

      await client.query(
        `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [newTeam.id, team.ownerId]
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

  async getTeam(id: string) {
    const result = await this.pool.query(`SELECT * FROM teams WHERE id = $1`, [id]);
    return result.rows[0] || null;
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

  async updateTeam(id: string, updates: Partial<any>) {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => updates[f])];

    await this.pool.query(`UPDATE teams SET ${setClauses}, updated_at = NOW() WHERE id = $1`, values);
  }

  // Team Members
  async addTeamMember(teamId: string, userId: string, role: string) {
    const result = await this.pool.query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3, is_active = true, updated_at = NOW()
       RETURNING *`,
      [teamId, userId, role]
    );
    return result.rows[0];
  }

  async removeTeamMember(teamId: string, userId: string) {
    await this.pool.query(
      `UPDATE team_members SET is_active = false, updated_at = NOW() WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
  }

  async updateMemberRole(teamId: string, userId: string, role: string) {
    await this.pool.query(
      `UPDATE team_members SET role = $3, updated_at = NOW() WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId, role]
    );
  }

  async getTeamMembers(teamId: string) {
    const result = await this.pool.query(
      `SELECT tm.*, u.email, u.name FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.is_active = true
       ORDER BY tm.role, u.name`,
      [teamId]
    );
    return result.rows;
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
  async createProject(project: { teamId: string; name: string; slug?: string; repoPath?: string; repoUrl?: string }) {
    const result = await this.pool.query(
      `INSERT INTO projects (team_id, name, slug, repo_path, repo_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [project.teamId, project.name, project.slug || null, project.repoPath || null, project.repoUrl || null]
    );
    return result.rows[0].id;
  }

  async getProject(id: string) {
    const result = await this.pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async getProjectsForTeam(teamId: string) {
    const result = await this.pool.query(
      `SELECT * FROM projects WHERE team_id = $1 AND is_active = true ORDER BY name`,
      [teamId]
    );
    return result.rows;
  }

  // Agents
  async upsertAgent(agent: { teamId: string; userId?: string; projectId?: string; toolName: string; toolVersion?: string; instanceId: string; agentName?: string }) {
    const result = await this.pool.query(
      `INSERT INTO agents (team_id, user_id, project_id, tool_name, tool_version, instance_id, agent_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (team_id, instance_id) DO UPDATE SET
         tool_version = $5, agent_name = $7, last_seen_at = NOW(), updated_at = NOW()
       RETURNING id`,
      [agent.teamId, agent.userId || null, agent.projectId || null, agent.toolName, agent.toolVersion || null, agent.instanceId, agent.agentName || null]
    );
    return result.rows[0].id;
  }

  async getAgentsForTeam(teamId: string) {
    const result = await this.pool.query(
      `SELECT * FROM agents WHERE team_id = $1 AND is_active = true ORDER BY last_seen_at DESC`,
      [teamId]
    );
    return result.rows;
  }

  // Sessions
  async createSession(session: { id: string; agentId: string; teamId: string; projectId?: string; userId?: string; branch?: string }) {
    await this.pool.query(
      `INSERT INTO sessions (id, agent_id, team_id, project_id, user_id, branch, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [session.id, session.agentId, session.teamId, session.projectId || null, session.userId || null, session.branch || null]
    );
  }

  async updateSession(id: string, updates: { endedAt?: Date; summary?: string; status?: string; eventCount?: number }) {
    const parts: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.endedAt) { parts.push(`ended_at = $${idx++}`); params.push(updates.endedAt); }
    if (updates.summary) { parts.push(`summary = $${idx++}`); params.push(updates.summary); }
    if (updates.status) { parts.push(`status = $${idx++}`); params.push(updates.status); }
    if (updates.eventCount !== undefined) { parts.push(`event_count = $${idx++}`); params.push(updates.eventCount); }

    if (parts.length > 0) {
      parts.push(`updated_at = NOW()`);
      params.push(id);
      await this.pool.query(`UPDATE sessions SET ${parts.join(', ')} WHERE id = $${idx}`, params);
    }
  }

  // Events
  async insertEvent(event: NautalisEvent): Promise<string> {
    const span = createSpan(SPAN_NAMES.INGEST_EVENT, {
      'event.type': event.type,
      'event.tool': event.toolName || 'unknown',
    });

    try {
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
    const result = await this.pool.query(
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

    const result = await this.pool.query(sql, params);
    return result.rows.map(this.rowToEvent);
  }

  // Memories
  async insertMemory(memory: Memory): Promise<string> {
    const span = createSpan(SPAN_NAMES.STORE_MEMORY, {
      'memory.type': memory.classification.memoryType,
    });

    try {
      const id = memory.id || uuidv4();

      await this.pool.query(
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
          memory.context.teamId || '',
          null,
          memory.agentIdentity.sessionId || null,
          memory.context.projectId || null,
          memory.agentIdentity.userId || null,
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
        await this.insertEmbedding(id, memory.embedding);
      }

      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_STORED, 1);
      return id;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

  async getMemory(id: string) {
    const result = await this.pool.query(
      `SELECT * FROM memories WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;

    await this.pool.query(
      `UPDATE memories SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = $1`,
      [id]
    );

    return this.rowToMemory(result.rows[0]);
  }

  async queryMemories(query: MemoryQuery): Promise<MemoryQueryResult[]> {
    const span = createSpan(SPAN_NAMES.QUERY_MEMORY, {
      'query.text': query.query,
    });

    try {
      let sql = `SELECT * FROM memories WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;

      if (query.projectId) { sql += ` AND project_id = $${idx++}`; params.push(query.projectId); }
      if (query.memoryType) { sql += ` AND memory_type = $${idx++}`; params.push(query.memoryType); }
      if (query.minImportance !== undefined) { sql += ` AND importance >= $${idx++}`; params.push(query.minImportance); }
      if (query.dateFrom) { sql += ` AND created_at >= $${idx++}`; params.push(query.dateFrom); }
      if (query.dateTo) { sql += ` AND created_at <= $${idx++}`; params.push(query.dateTo); }

      sql += ` ORDER BY importance DESC, created_at DESC LIMIT $${idx++}`;
      params.push(query.limit || 20);

      const result = await this.pool.query(sql, params);
      const results = result.rows.map(row => ({
        memory: this.rowToMemory(row),
        score: 1.0,
        matchedTopics: [],
        matchedFiles: [],
      }));

      span.end();
      return results;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

  async updateMemory(id: string, updates: Partial<Memory>) {
    // TODO: Implement partial update
  }

  async deleteMemory(id: string) {
    await this.pool.query(`DELETE FROM memory_embeddings WHERE memory_id = $1`, [id]);
    await this.pool.query(`DELETE FROM memories WHERE id = $1`, [id]);
  }

  async listMemories(teamId: string, filters?: { projectId?: string; memoryType?: string; limit?: number }) {
    let sql = `SELECT * FROM memories WHERE team_id = $1`;
    const params: any[] = [teamId];
    let idx = 2;

    if (filters?.projectId) { sql += ` AND project_id = $${idx++}`; params.push(filters.projectId); }
    if (filters?.memoryType) { sql += ` AND memory_type = $${idx++}`; params.push(filters.memoryType); }

    sql += ` ORDER BY importance DESC, created_at DESC LIMIT $${idx++}`;
    params.push(filters?.limit || 50);

    const result = await this.pool.query(sql, params);
    return result.rows.map(this.rowToMemory);
  }

  async findSimilarMemories(embedding: number[], teamId: string, limit = 10, minScore = 0.7) {
    const result = await this.pool.query(
      `SELECT m.*, 1 - (me.embedding <=> $1::vector) AS similarity
       FROM memory_embeddings me
       JOIN memories m ON m.id = me.memory_id
       WHERE m.team_id = $2 AND m.is_stale = false
       AND 1 - (me.embedding <=> $1::vector) >= $3
       ORDER BY me.embedding <=> $1::vector
       LIMIT $4`,
      [`[${embedding.join(',')}]`, teamId, minScore, limit]
    );

    return result.rows.map(row => ({
      memory: this.rowToMemory(row),
      score: row.similarity,
      matchedTopics: [],
      matchedFiles: [],
    }));
  }

  async insertEmbedding(memoryId: string, embedding: number[]) {
    await this.pool.query(
      `INSERT INTO memory_embeddings (memory_id, embedding) VALUES ($1, $2::vector)
       ON CONFLICT (memory_id) DO UPDATE SET embedding = $2::vector`,
      [memoryId, `[${embedding.join(',')}]`]
    );
  }

  // Knowledge Base (delegated)
  async createKnowledgeBase(entry: any) { return this.kbEngine.create(entry); }
  async getKnowledgeBase(id: string) { return this.kbEngine.get(id); }
  async queryKnowledgeBase(query: any) { return this.kbEngine.query(query); }
  async updateKnowledgeBase(id: string, updates: any) { return this.kbEngine.update(id, updates); }
  async deleteKnowledgeBase(id: string) { return this.kbEngine.delete(id); }
  async searchKnowledgeBase(teamId: string, query: string, embedding?: number[], options?: any) {
    return this.kbEngine.search(teamId, query, embedding, options);
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
  async logAudit(teamId: string, userId: string, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) {
    await this.pool.query(
      `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [teamId, userId, action, resourceType, resourceId || null, details?.oldValues ? JSON.stringify(details.oldValues) : null, details?.newValues ? JSON.stringify(details.newValues) : null]
    );
  }

  // Stats
  async getTeamDashboard(teamId: string) {
    const result = await this.pool.query(`SELECT get_team_dashboard($1) AS dashboard`, [teamId]);
    return result.rows[0]?.dashboard || {};
  }

  async getStats() {
    const users = await this.pool.query(`SELECT COUNT(*)::int FROM users`);
    const teams = await this.pool.query(`SELECT COUNT(*)::int FROM teams`);
    const projects = await this.pool.query(`SELECT COUNT(*)::int FROM projects`);
    const agents = await this.pool.query(`SELECT COUNT(*)::int FROM agents`);
    const memories = await this.pool.query(`SELECT COUNT(*)::int FROM memories`);
    const events = await this.pool.query(`SELECT COUNT(*)::int FROM events`);

    return {
      totalUsers: users.rows[0].count,
      totalTeams: teams.rows[0].count,
      totalProjects: projects.rows[0].count,
      totalAgents: agents.rows[0].count,
      totalMemories: memories.rows[0].count,
      totalEvents: events.rows[0].count,
    };
  }

  private rowToEvent(row: any): NautalisEvent {
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
      toolOutput: row.tool_output ? JSON.parse(row.tool_output) : undefined,
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
