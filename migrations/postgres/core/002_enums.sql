-- Team roles (hierarchy: owner > admin > manager > member > viewer)
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');

-- Permission scopes
CREATE TYPE permission_scope AS ENUM ('team', 'project', 'agent', 'memory', 'knowledge_base', 'telemetry', 'settings');

-- Permission actions
CREATE TYPE permission_action AS ENUM ('read', 'write', 'delete', 'admin', 'share', 'export', 'import');

-- Memory types
CREATE TYPE memory_type AS ENUM ('episodic', 'semantic', 'procedural', 'decision', 'lesson', 'preference');

-- Memory sensitivity
CREATE TYPE sensitivity_level AS ENUM ('public', 'internal', 'confidential', 'secret');

-- Agent tool types
CREATE TYPE agent_tool AS ENUM (
    'claude_code', 'kilo_code', 'opencode', 'cursor', 'windsurf',
    'vscode', 'zed', 'aider', 'cline', 'codex', 'gemini_cli',
    'devin', 'custom'
);

-- Event types
CREATE TYPE event_type AS ENUM (
    'tool_use', 'file_edit', 'file_read', 'file_write', 'file_create',
    'file_delete', 'command', 'decision', 'error', 'conversation',
    'session_start', 'session_end', 'network', 'etl'
);

-- Knowledge base visibility
CREATE TYPE kb_visibility AS ENUM ('public', 'team', 'project', 'private');

-- Audit action types
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'permission_change', 'share', 'export');
