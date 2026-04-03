-- Universal Knowledge Base — AI agents can pull from this
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    
    -- Content
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'markdown',  -- markdown, html, plain_text, code
    
    -- Classification
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    
    -- Visibility and permissions
    visibility kb_visibility DEFAULT 'team',
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_version_id UUID REFERENCES knowledge_base(id),
    
    -- AI metadata
    source VARCHAR(100),  -- 'manual', 'auto_extracted', 'ai_generated', 'imported'
    source_agent_id UUID REFERENCES agents(id),
    confidence REAL DEFAULT 1.0,
    
    -- Status
    is_published BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Access tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base embeddings (pgvector)
CREATE TABLE knowledge_base_embeddings (
    kb_id UUID PRIMARY KEY REFERENCES knowledge_base(id) ON DELETE CASCADE,
    embedding vector(384) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base edit history
CREATE TABLE knowledge_base_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    
    -- Change
    change_type VARCHAR(50) NOT NULL,  -- 'create', 'update', 'publish', 'archive'
    old_content TEXT,
    new_content TEXT,
    change_summary TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX kb_embeddings_idx ON knowledge_base_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search
CREATE INDEX kb_fts_idx ON knowledge_base USING GIN (
    to_tsvector('english', title || ' ' || content || ' ' || COALESCE(array_to_string(tags, ' '), ''))
);

-- Indexes
CREATE INDEX idx_kb_team ON knowledge_base(team_id);
CREATE INDEX idx_kb_project ON knowledge_base(project_id);
CREATE INDEX idx_kb_visibility ON knowledge_base(visibility);
CREATE INDEX idx_kb_category ON knowledge_base(category);
CREATE INDEX idx_kb_tags ON knowledge_base USING GIN (tags);
CREATE INDEX idx_kb_topics ON knowledge_base USING GIN (topics);
CREATE INDEX idx_kb_published ON knowledge_base(is_published);
