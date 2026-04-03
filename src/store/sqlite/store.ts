import Database from 'better-sqlite3';
import type { Store } from '../interface.js';
import type { NautalisEvent } from '../../types/event.js';
import type { Memory, MemoryQuery, MemoryQueryResult } from '../../types/memory.js';
import { v4 as uuidv4 } from 'uuid';
import { createSpan, recordMetric, logMessage } from '../../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../../types/telemetry.js';
import * as fs from 'fs';
import * as path from 'path';

export class SqliteStore implements Store {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    const expandedPath = dbPath.replace(/^~/, process.env.HOME || '');
    const dir = path.dirname(expandedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(expandedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }
  
  async init(): Promise<void> {
    const span = createSpan(SPAN_NAMES.STORE_MEMORY + '.init', { db_driver: 'sqlite' });
    try {
      const migrations = this.getMigrations();
      for (const migration of migrations) {
        this.db.exec(migration);
      }
      span.end();
      logMessage('info', 'SQLite store initialized');
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    this.db.close();
  }
  
  private getMigrations(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        tool_version TEXT,
        instance_id TEXT NOT NULL,
        agent_name TEXT,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(instance_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT,
        repo_path TEXT UNIQUE,
        repo_url TEXT,
        team_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT REFERENCES agents(id),
        project_id TEXT REFERENCES projects(id),
        branch TEXT,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        summary TEXT,
        transcript_path TEXT,
        status TEXT DEFAULT 'active',
        event_count INTEGER DEFAULT 0
      )`,
      
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
        timestamp TIMESTAMP,
        event_type TEXT NOT NULL,
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        files_involved TEXT,
        exit_code INTEGER,
        duration_ms INTEGER,
        metadata TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT REFERENCES agents(id),
        session_id TEXT REFERENCES sessions(id),
        project_id TEXT REFERENCES projects(id),
        team_id TEXT,
        memory_type TEXT NOT NULL,
        block_label TEXT,
        topics TEXT,
        confidence REAL DEFAULT 0.5,
        importance REAL DEFAULT 0.5,
        sensitivity TEXT DEFAULT 'internal',
        summary TEXT NOT NULL,
        detail TEXT,
        files_involved TEXT,
        commands_exec TEXT,
        errors_seen TEXT,
        code_snippets TEXT,
        parent_memory_id TEXT REFERENCES memories(id),
        supersedes TEXT,
        contradicts TEXT,
        supports TEXT,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        ttl TIMESTAMP,
        decay_rate REAL DEFAULT 0.01,
        is_stale BOOLEAN DEFAULT FALSE,
        repo_path TEXT,
        repo_url TEXT,
        branch TEXT,
        cwd TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id TEXT PRIMARY KEY REFERENCES memories(id),
        embedding BLOB NOT NULL
      )`,
      
      `CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        summary, detail, block_label, topics, tags,
        content='memories', content_rowid='rowid'
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_stale ON memories(is_stale)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`,
    ];
  }
  
  async insertEvent(event: NautalisEvent): Promise<string> {
    const span = createSpan(SPAN_NAMES.INGEST_EVENT, {
      'event.type': event.type,
      'event.tool': event.toolName || 'unknown',
    });
    
    try {
      const id = event.eventId || uuidv4();
      
      await this.upsertAgent({
        id: `${event.source.toolName}:${event.source.instanceId}`,
        toolName: event.source.toolName,
        toolVersion: event.source.toolVersion,
        instanceId: event.source.instanceId,
        agentName: event.source.agentName,
        userId: event.source.userId,
      });
      
      await this.upsertProject({
        id: event.project.projectId,
        repoPath: event.project.repoPath,
        repoUrl: event.project.repoUrl,
        teamId: event.project.teamId,
      });
      
      await this.upsertSession({
        id: event.source.sessionId,
        agentId: `${event.source.toolName}:${event.source.instanceId}`,
        projectId: event.project.projectId,
        branch: event.project.branch,
        startedAt: event.timestamp,
        status: 'active',
      });
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO events (id, session_id, timestamp, event_type, tool_name, tool_input, tool_output, files_involved, exit_code, duration_ms, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        event.source.sessionId,
        event.timestamp.toISOString(),
        event.type,
        event.toolName || null,
        event.toolInput ? JSON.stringify(event.toolInput) : null,
        event.toolOutput ? JSON.stringify(event.toolOutput) : null,
        JSON.stringify(event.filesInvolved),
        event.toolOutput?.exitCode ?? null,
        null,
        event.raw ? JSON.stringify(event.raw) : null
      );
      
      span.end();
      recordMetric(METRIC_NAMES.EVENTS_INGESTED, 1, { tool: event.source.toolName });
      return id;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
  
  async getEventsBySession(sessionId: string): Promise<NautalisEvent[]> {
    const rows = this.db.prepare('SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC').all(sessionId) as any[];
    return rows.map(this.rowToEvent);
  }
  
  async getEventsByProject(projectId: string, limit = 100): Promise<NautalisEvent[]> {
    const rows = this.db.prepare(`
      SELECT e.* FROM events e
      JOIN sessions s ON e.session_id = s.id
      WHERE s.project_id = ?
      ORDER BY e.timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];
    return rows.map(this.rowToEvent);
  }
  
  async insertMemory(memory: Memory): Promise<string> {
    const span = createSpan(SPAN_NAMES.STORE_MEMORY, {
      'memory.type': memory.classification.memoryType,
      'memory.importance': memory.classification.importance,
    });
    
    try {
      const id = memory.id || uuidv4();
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories (
          id, agent_id, session_id, project_id, team_id,
          memory_type, block_label, topics, confidence, importance, sensitivity,
          summary, detail, files_involved, commands_exec, errors_seen, code_snippets,
          parent_memory_id, supersedes, contradicts, supports, tags,
          created_at, updated_at, accessed_at, access_count,
          ttl, decay_rate, is_stale,
          repo_path, repo_url, branch, cwd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        `${memory.agentIdentity.toolName}:${memory.agentIdentity.instanceId}`,
        memory.agentIdentity.sessionId,
        memory.context.projectId,
        memory.context.teamId || null,
        memory.classification.memoryType,
        memory.classification.blockLabel,
        JSON.stringify(memory.classification.topics),
        memory.classification.confidence,
        memory.classification.importance,
        memory.classification.sensitivity,
        memory.content.summary,
        memory.content.detail || null,
        JSON.stringify(memory.content.filesInvolved),
        JSON.stringify(memory.content.commandsExec),
        JSON.stringify(memory.content.errorsSeen),
        JSON.stringify(memory.content.codeSnippets),
        memory.relationships.parentMemoryId || null,
        JSON.stringify(memory.relationships.supersedes),
        JSON.stringify(memory.relationships.contradicts),
        JSON.stringify(memory.relationships.supports),
        JSON.stringify(memory.relationships.tags),
        memory.createdAt.toISOString(),
        memory.updatedAt.toISOString(),
        memory.lifecycle.lastAccess.toISOString(),
        memory.lifecycle.accessCount,
        memory.lifecycle.ttl?.toISOString() || null,
        memory.lifecycle.decayRate,
        memory.lifecycle.isStale ? 1 : 0,
        memory.context.repoPath,
        memory.context.repoUrl || null,
        memory.context.branch || null,
        memory.context.cwd,
      );
      
      if (memory.embedding) {
        await this.insertEmbedding(id, memory.embedding);
      }
      
      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_STORED, 1, { type: memory.classification.memoryType });
      return id;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
  
  async getMemory(id: string): Promise<Memory | null> {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (!row) return null;
    
    this.db.prepare('UPDATE memories SET access_count = access_count + 1, accessed_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    
    return this.rowToMemory(row);
  }
  
  async queryMemories(query: MemoryQuery): Promise<MemoryQueryResult[]> {
    const span = createSpan(SPAN_NAMES.QUERY_MEMORY, {
      'query.text': query.query,
      'query.project': query.projectId || 'all',
    });
    
    try {
      let sql = 'SELECT * FROM memories WHERE 1=1';
      const params: any[] = [];
      
      if (query.projectId) {
        sql += ' AND project_id = ?';
        params.push(query.projectId);
      }
      if (query.memoryType) {
        sql += ' AND memory_type = ?';
        params.push(query.memoryType);
      }
      if (query.minImportance !== undefined) {
        sql += ' AND importance >= ?';
        params.push(query.minImportance);
      }
      if (query.dateFrom) {
        sql += ' AND created_at >= ?';
        params.push(query.dateFrom.toISOString());
      }
      if (query.dateTo) {
        sql += ' AND created_at <= ?';
        params.push(query.dateTo.toISOString());
      }
      
      sql += ' ORDER BY importance DESC, created_at DESC';
      sql += ` LIMIT ${query.limit || 20}`;
      
      const rows = this.db.prepare(sql).all(...params) as any[];
      const results: MemoryQueryResult[] = rows.map(row => ({
        memory: this.rowToMemory(row),
        score: 1.0,
        matchedTopics: [],
        matchedFiles: [],
      }));
      
      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_QUERIED, 1, { result_count: results.length });
      return results;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
  
  async updateMemory(id: string, updates: Partial<Memory>): Promise<void> {
    logMessage('warn', 'updateMemory not fully implemented', { memory_id: id });
  }
  
  async deleteMemory(id: string): Promise<void> {
    this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM memory_embeddings WHERE memory_id = ?').run(id);
  }
  
  async listMemories(filters?: { projectId?: string; memoryType?: string; limit?: number }): Promise<Memory[]> {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.projectId) {
      sql += ' AND project_id = ?';
      params.push(filters.projectId);
    }
    if (filters?.memoryType) {
      sql += ' AND memory_type = ?';
      params.push(filters.memoryType);
    }
    
    sql += ' ORDER BY importance DESC, created_at DESC';
    sql += ` LIMIT ${filters?.limit || 50}`;
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToMemory);
  }
  
  async insertEmbedding(memoryId: string, embedding: number[]): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)'
    );
    stmt.run(memoryId, JSON.stringify(embedding));
  }
  
  async searchEmbeddings(embedding: number[], limit = 10): Promise<{ memoryId: string; score: number }[]> {
    logMessage('warn', 'Vector search not yet implemented');
    return [];
  }
  
  async upsertAgent(agent: { id: string; toolName: string; toolVersion?: string; instanceId: string; agentName?: string; userId: string }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agents (id, tool_name, tool_version, instance_id, agent_name, user_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(agent.id, agent.toolName, agent.toolVersion || null, agent.instanceId, agent.agentName || null, agent.userId);
  }
  
  async upsertProject(project: { id: string; name?: string; repoPath: string; repoUrl?: string; teamId?: string }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, repo_path, repo_url, team_id, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(project.id, project.name || null, project.repoPath, project.repoUrl || null, project.teamId || null);
  }
  
  async getProject(id: string): Promise<{ id: string; name?: string; repoPath: string; repoUrl?: string; teamId?: string } | null> {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any || null;
  }
  
  async upsertSession(session: { id: string; agentId: string; projectId?: string; branch?: string; startedAt: Date; status?: string }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, agent_id, project_id, branch, started_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.agentId, session.projectId || null, session.branch || null, session.startedAt.toISOString(), session.status || 'active');
  }
  
  async updateSession(id: string, updates: { endedAt?: Date; summary?: string; status?: string; eventCount?: number }): Promise<void> {
    const parts: string[] = [];
    const params: any[] = [];
    
    if (updates.endedAt) { parts.push('ended_at = ?'); params.push(updates.endedAt.toISOString()); }
    if (updates.summary) { parts.push('summary = ?'); params.push(updates.summary); }
    if (updates.status) { parts.push('status = ?'); params.push(updates.status); }
    if (updates.eventCount !== undefined) { parts.push('event_count = ?'); params.push(updates.eventCount); }
    
    if (parts.length > 0) {
      params.push(id);
      this.db.prepare(`UPDATE sessions SET ${parts.join(', ')} WHERE id = ?`).run(...params);
    }
  }
  
  async getStats(): Promise<{ totalEvents: number; totalMemories: number; totalAgents: number; totalProjects: number; totalSessions: number }> {
    const events = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    const memories = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
    const agents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    const projects = this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    
    return {
      totalEvents: events.count,
      totalMemories: memories.count,
      totalAgents: agents.count,
      totalProjects: projects.count,
      totalSessions: sessions.count,
    };
  }
  
  private rowToEvent(row: any): NautalisEvent {
    return {
      eventId: row.id,
      timestamp: new Date(row.timestamp),
      source: {} as any,
      project: {} as any,
      type: row.event_type,
      toolName: row.tool_name,
      toolInput: row.tool_input ? JSON.parse(row.tool_input) : undefined,
      toolOutput: row.tool_output ? JSON.parse(row.tool_output) : undefined,
      filesInvolved: row.files_involved ? JSON.parse(row.files_involved) : [],
      context: {} as any,
      extracted: { decisions: [], errors: [], topics: [] },
    };
  }
  
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      agentIdentity: {
        toolName: row.agent_id?.split(':')[0] || '',
        toolVersion: '',
        instanceId: row.agent_id?.split(':')[1] || '',
        sessionId: row.session_id,
        agentName: '',
        userId: '',
      },
      context: {
        teamId: row.team_id,
        projectId: row.project_id,
        repoPath: row.repo_path,
        repoUrl: row.repo_url,
        branch: row.branch,
        cwd: row.cwd,
        platform: process.platform,
      },
      classification: {
        memoryType: row.memory_type,
        blockLabel: row.block_label,
        topics: row.topics ? JSON.parse(row.topics) : [],
        confidence: row.confidence,
        importance: row.importance,
        sensitivity: row.sensitivity,
      },
      content: {
        summary: row.summary,
        detail: row.detail,
        filesInvolved: row.files_involved ? JSON.parse(row.files_involved) : [],
        commandsExec: row.commands_exec ? JSON.parse(row.commands_exec) : [],
        errorsSeen: row.errors_seen ? JSON.parse(row.errors_seen) : [],
        codeSnippets: row.code_snippets ? JSON.parse(row.code_snippets) : [],
      },
      relationships: {
        parentMemoryId: row.parent_memory_id,
        supersedes: row.supersedes ? JSON.parse(row.supersedes) : [],
        contradicts: row.contradicts ? JSON.parse(row.contradicts) : [],
        supports: row.supports ? JSON.parse(row.supports) : [],
        tags: row.tags ? JSON.parse(row.tags) : [],
      },
      lifecycle: {
        ttl: row.ttl ? new Date(row.ttl) : undefined,
        decayRate: row.decay_rate,
        lastAccess: new Date(row.accessed_at),
        accessCount: row.access_count,
        isStale: Boolean(row.is_stale),
      },
    };
  }
}
