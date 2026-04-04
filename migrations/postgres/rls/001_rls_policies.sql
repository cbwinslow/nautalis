-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Telemetry table may not exist if TimescaleDB extension is not installed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telemetry' AND table_schema = 'public') THEN
    ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Helper function to check user's role in a team
CREATE OR REPLACE FUNCTION has_team_role(p_team_id UUID, p_user_id UUID, p_role team_role)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND user_id = p_user_id
        AND role >= p_role
        AND is_active = true
    );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get user's team
CREATE OR REPLACE FUNCTION get_user_teams(p_user_id UUID)
RETURNS TABLE(team_id UUID) AS $$
    SELECT team_id FROM team_members
    WHERE user_id = p_user_id AND is_active = true;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check permission
CREATE OR REPLACE FUNCTION has_permission(p_user_id UUID, p_team_id UUID, p_scope permission_scope, p_action permission_action)
RETURNS BOOLEAN AS $$
DECLARE
    user_role team_role;
    has_override BOOLEAN;
    override_granted BOOLEAN;
BEGIN
    -- Get user's role
    SELECT role INTO user_role FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND is_active = true;
    
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check for team-level override
    SELECT granted INTO override_granted FROM team_permissions
    WHERE team_id = p_team_id AND user_id = p_user_id AND scope = p_scope AND action = p_action;
    
    IF FOUND THEN
        RETURN override_granted;
    END IF;
    
    -- Check role permissions
    SELECT granted INTO has_override FROM role_permissions
    WHERE role = user_role AND scope = p_scope AND action = p_action;
    
    RETURN COALESCE(has_override, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users: users can only see their own profile
CREATE POLICY users_self ON users
    FOR ALL USING (id = auth.uid() OR auth.uid() IS NULL);

-- Teams: users can see teams they're members of
CREATE POLICY teams_access ON teams
    FOR SELECT USING (
        id IN (SELECT get_user_teams(auth.uid()))
    );

-- Team members: users can see members of their teams
CREATE POLICY team_members_access ON team_members
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
    );

-- Projects: team members can see their team's projects
CREATE POLICY projects_access ON projects
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
    );
CREATE POLICY projects_write ON projects
    FOR ALL USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_permission(auth.uid(), team_id, 'project', 'write')
    );

-- Agents: team members can see their team's agents
CREATE POLICY agents_access ON agents
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
    );
CREATE POLICY agents_write ON agents
    FOR ALL USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_permission(auth.uid(), team_id, 'agent', 'write')
    );

-- Sessions: team members can see their team's sessions
CREATE POLICY sessions_access ON sessions
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
    );

-- Events: team members can see their team's events
CREATE POLICY events_access ON events
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
    );
CREATE POLICY events_write ON events
    FOR ALL USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_permission(auth.uid(), team_id, 'agent', 'write')
    );

-- Memories: team members can see memories based on sensitivity + permissions
CREATE POLICY memories_access ON memories
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND (
            sensitivity = 'public'
            OR sensitivity = 'internal'
            OR (sensitivity = 'confidential' AND has_team_role(team_id, auth.uid(), 'manager'))
            OR (sensitivity = 'secret' AND has_team_role(team_id, auth.uid(), 'admin'))
        )
    );
CREATE POLICY memories_write ON memories
    FOR ALL USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_permission(auth.uid(), team_id, 'memory', 'write')
    );

-- Knowledge base: based on visibility + team membership
CREATE POLICY kb_access ON knowledge_base
    FOR SELECT USING (
        visibility = 'public'
        OR (visibility = 'team' AND team_id IN (SELECT get_user_teams(auth.uid())))
        OR (visibility = 'project' AND project_id IN (
            SELECT id FROM projects WHERE team_id IN (SELECT get_user_teams(auth.uid()))
        ))
        OR (visibility = 'private' AND created_by = auth.uid())
    );
CREATE POLICY kb_write ON knowledge_base
    FOR ALL USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_permission(auth.uid(), team_id, 'knowledge_base', 'write')
    );

-- Audit log: only admins and owners can see
CREATE POLICY audit_log_access ON audit_log
    FOR SELECT USING (
        team_id IN (SELECT get_user_teams(auth.uid()))
        AND has_team_role(team_id, auth.uid(), 'admin')
    );

-- Telemetry: team members can see their team's telemetry (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telemetry' AND table_schema = 'public') THEN
    CREATE POLICY telemetry_access ON telemetry
        FOR SELECT USING (
            team_id IN (SELECT get_user_teams(auth.uid()))
        );
  END IF;
END $$;
