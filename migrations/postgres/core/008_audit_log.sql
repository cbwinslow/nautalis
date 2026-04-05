-- Audit log (will be converted to TimescaleDB hypertable)
CREATE TABLE audit_log (
    id UUID DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    agent_id UUID REFERENCES agents(id),
    
    -- Action
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id TEXT,  -- Can be a UUID or composite key like "teamId:userId"
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key includes timestamp for TimescaleDB hypertable conversion
    PRIMARY KEY (id, timestamp)
);

CREATE INDEX idx_audit_log_team ON audit_log(team_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
