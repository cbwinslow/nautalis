-- Events (will be converted to TimescaleDB hypertable later)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    
    -- Event data
    event_type event_type NOT NULL,
    tool_name VARCHAR(100),
    tool_input JSONB,
    tool_output JSONB,
    files_involved TEXT[] DEFAULT '{}',
    exit_code INTEGER,
    duration_ms INTEGER,
    
    -- Extracted data
    decisions TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    
    -- Raw data
    raw JSONB,
    
    -- Timestamp (critical for time-series)
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memories
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    
    -- Classification
    memory_type memory_type NOT NULL,
    block_label VARCHAR(255),
    topics TEXT[] DEFAULT '{}',
    confidence REAL DEFAULT 0.5,
    importance REAL DEFAULT 0.5,
    sensitivity sensitivity_level DEFAULT 'internal',
    
    -- Content
    summary TEXT NOT NULL,
    detail TEXT,
    files_involved TEXT[] DEFAULT '{}',
    commands_exec TEXT[] DEFAULT '{}',
    errors_seen TEXT[] DEFAULT '{}',
    code_snippets TEXT[] DEFAULT '{}',
    
    -- Relationships
    parent_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
    supersedes UUID[] DEFAULT '{}',
    contradicts UUID[] DEFAULT '{}',
    supports UUID[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Lifecycle
    ttl TIMESTAMPTZ,
    decay_rate REAL DEFAULT 0.01,
    is_stale BOOLEAN DEFAULT FALSE,
    
    -- Context
    repo_path TEXT,
    repo_url TEXT,
    branch TEXT,
    cwd TEXT,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory embeddings (pgvector)
CREATE TABLE memory_embeddings (
    memory_id UUID PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
    embedding vector(384) NOT NULL,  -- nomic-embed-text: 384 dimensions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search on memories
-- Temporarily commented out due to index expression immutability error in some PostgreSQL configurations
-- CREATE INDEX memories_fts_idx ON memories USING GIN (
--     to_tsvector('english', summary || ' ' || COALESCE(detail, '') || ' ' || COALESCE(array_to_string(topics, ' '), ''))
-- );

-- Vector similarity search index
-- Temporarily commented out because ivfflat requires data to build centroids; will be created after data insertion
-- CREATE INDEX memory_embeddings_idx ON memory_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes
CREATE INDEX idx_events_team ON events(team_id);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_agent ON events(agent_id);
CREATE INDEX idx_events_project ON events(project_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_topics ON events USING GIN (topics);

CREATE INDEX idx_memories_team ON memories(team_id);
CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_project ON memories(project_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_sensitivity ON memories(sensitivity);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_stale ON memories(is_stale);
CREATE INDEX idx_memories_topics ON memories USING GIN (topics);
CREATE INDEX idx_memories_tags ON memories USING GIN (tags);
CREATE INDEX idx_memories_parent ON memories(parent_memory_id);
