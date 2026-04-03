-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100),
    description TEXT,
    
    -- Repository
    repo_path TEXT,
    repo_url TEXT,
    default_branch VARCHAR(100) DEFAULT 'main',
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(team_id, slug)
);

-- Agents (AI tool instances)
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    
    -- Identity
    tool_name agent_tool NOT NULL,
    tool_version VARCHAR(50),
    instance_id VARCHAR(255) NOT NULL,
    agent_name VARCHAR(255),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    
    -- Stats
    total_sessions INTEGER DEFAULT 0,
    total_events INTEGER DEFAULT 0,
    total_memories INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(team_id, instance_id)
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY,  -- Use the agent's session ID
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    
    -- Context
    branch VARCHAR(255),
    cwd TEXT,
    
    -- Summary
    summary TEXT,
    transcript_path TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    event_count INTEGER DEFAULT 0,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_agents_team ON agents(team_id);
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_project ON agents(project_id);
CREATE INDEX idx_sessions_agent ON sessions(agent_id);
CREATE INDEX idx_sessions_team ON sessions(team_id);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(status);
