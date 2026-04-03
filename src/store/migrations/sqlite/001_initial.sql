-- Nautalis Initial Schema
-- SQLite + sqlite-vec compatible

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    tool_name TEXT NOT NULL,
    tool_version TEXT,
    instance_id TEXT NOT NULL UNIQUE,
    agent_name TEXT,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    repo_path TEXT UNIQUE,
    repo_url TEXT,
    team_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
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
);

CREATE TABLE IF NOT EXISTS events (
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
);

CREATE TABLE IF NOT EXISTS memories (
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
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
    memory_id TEXT PRIMARY KEY REFERENCES memories(id),
    embedding BLOB NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    summary, detail, block_label, topics, tags,
    content='memories', content_rowid='rowid'
);

CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_stale ON memories(is_stale);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
