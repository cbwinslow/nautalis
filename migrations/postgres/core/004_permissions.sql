-- Role-permission matrix (defines what each role can do per scope)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role team_role NOT NULL,
    scope permission_scope NOT NULL,
    action permission_action NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    
    UNIQUE(role, scope, action),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom team-level permission overrides
CREATE TABLE team_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope permission_scope NOT NULL,
    action permission_action NOT NULL,
    granted BOOLEAN NOT NULL,
    
    -- Who set this override
    set_by UUID REFERENCES users(id),
    
    UNIQUE(team_id, user_id, scope, action),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource-level sharing (who has access to specific resources)
CREATE TABLE resource_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,  -- 'memory', 'knowledge_base', 'project'
    resource_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    target_team_id UUID REFERENCES teams(id),  -- Share with another team
    actions permission_action[] DEFAULT '{read}',
    
    -- Who shared it
    shared_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default role permissions
INSERT INTO role_permissions (role, scope, action, granted) VALUES
-- Owner: everything
('owner', 'team', 'admin', true),
('owner', 'team', 'read', true),
('owner', 'team', 'write', true),
('owner', 'team', 'delete', true),
('owner', 'project', 'admin', true),
('owner', 'project', 'read', true),
('owner', 'project', 'write', true),
('owner', 'project', 'delete', true),
('owner', 'agent', 'admin', true),
('owner', 'agent', 'read', true),
('owner', 'agent', 'write', true),
('owner', 'agent', 'delete', true),
('owner', 'memory', 'read', true),
('owner', 'memory', 'write', true),
('owner', 'memory', 'delete', true),
('owner', 'memory', 'export', true),
('owner', 'memory', 'share', true),
('owner', 'knowledge_base', 'read', true),
('owner', 'knowledge_base', 'write', true),
('owner', 'knowledge_base', 'delete', true),
('owner', 'knowledge_base', 'share', true),
('owner', 'telemetry', 'read', true),
('owner', 'telemetry', 'export', true),
('owner', 'settings', 'admin', true),
('owner', 'settings', 'read', true),
('owner', 'settings', 'write', true),

-- Admin: almost everything
('admin', 'team', 'read', true),
('admin', 'team', 'write', true),
('admin', 'project', 'admin', true),
('admin', 'project', 'read', true),
('admin', 'project', 'write', true),
('admin', 'project', 'delete', true),
('admin', 'agent', 'admin', true),
('admin', 'agent', 'read', true),
('admin', 'agent', 'write', true),
('admin', 'agent', 'delete', true),
('admin', 'memory', 'read', true),
('admin', 'memory', 'write', true),
('admin', 'memory', 'delete', true),
('admin', 'memory', 'export', true),
('admin', 'memory', 'share', true),
('admin', 'knowledge_base', 'read', true),
('admin', 'knowledge_base', 'write', true),
('admin', 'knowledge_base', 'delete', true),
('admin', 'knowledge_base', 'share', true),
('admin', 'telemetry', 'read', true),
('admin', 'telemetry', 'export', true),
('admin', 'settings', 'read', true),
('admin', 'settings', 'write', true),

-- Manager: team-scoped management
('manager', 'team', 'read', true),
('manager', 'project', 'admin', true),
('manager', 'project', 'read', true),
('manager', 'project', 'write', true),
('manager', 'project', 'delete', true),
('manager', 'agent', 'read', true),
('manager', 'agent', 'write', true),
('manager', 'memory', 'read', true),
('manager', 'memory', 'write', true),
('manager', 'memory', 'delete', true),
('manager', 'memory', 'export', true),
('manager', 'memory', 'share', true),
('manager', 'knowledge_base', 'read', true),
('manager', 'knowledge_base', 'write', true),
('manager', 'knowledge_base', 'share', true),
('manager', 'telemetry', 'read', true),
('manager', 'settings', 'read', true),

-- Member: read/write own work
('member', 'project', 'read', true),
('member', 'project', 'write', true),
('member', 'agent', 'read', true),
('member', 'agent', 'write', true),
('member', 'memory', 'read', true),
('member', 'memory', 'write', true),
('member', 'memory', 'export', true),
('member', 'knowledge_base', 'read', true),
('member', 'knowledge_base', 'write', true),
('member', 'telemetry', 'read', true),

-- Viewer: read only
('viewer', 'project', 'read', true),
('viewer', 'agent', 'read', true),
('viewer', 'memory', 'read', true),
('viewer', 'knowledge_base', 'read', true),
('viewer', 'telemetry', 'read', true);

-- Indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_team_permissions_team ON team_permissions(team_id);
CREATE INDEX idx_team_permissions_user ON team_permissions(user_id);
CREATE INDEX idx_resource_shares_resource ON resource_shares(resource_type, resource_id);
CREATE INDEX idx_resource_shares_user ON resource_shares(user_id);
