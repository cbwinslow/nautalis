-- Team roles (hierarchy: owner > admin > manager > member > viewer)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role') THEN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');
  END IF;
END $$;

-- Permission scopes
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_scope') THEN
    CREATE TYPE permission_scope AS ENUM ('team', 'project', 'agent', 'memory', 'knowledge_base', 'telemetry', 'settings');
  END IF;
END $$;

-- Permission actions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_action') THEN
    CREATE TYPE permission_action AS ENUM ('read', 'write', 'delete', 'admin', 'share', 'export', 'import');
  END IF;
END $$;

-- Memory types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type') THEN
    CREATE TYPE memory_type AS ENUM ('episodic', 'semantic', 'procedural', 'decision', 'lesson', 'preference');
  END IF;
END $$;

-- Memory sensitivity
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensitivity_level') THEN
    CREATE TYPE sensitivity_level AS ENUM ('public', 'internal', 'confidential', 'secret');
  END IF;
END $$;

-- Agent tool types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_tool') THEN
    CREATE TYPE agent_tool AS ENUM (
        'claude_code', 'kilo_code', 'opencode', 'cursor', 'windsurf',
        'vscode', 'zed', 'aider', 'cline', 'codex', 'gemini_cli',
        'devin', 'custom'
    );
  END IF;
END $$;

-- Event types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM (
        'tool_use', 'file_edit', 'file_read', 'file_write', 'file_create',
        'file_delete', 'command', 'decision', 'error', 'conversation',
        'session_start', 'session_end', 'network', 'etl'
    );
  END IF;
END $$;

-- Knowledge base visibility
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kb_visibility') THEN
    CREATE TYPE kb_visibility AS ENUM ('public', 'team', 'project', 'private');
  END IF;
END $$;

-- Audit action types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM (
      'create', 'read', 'update', 'delete',
      'login', 'logout',
      'permission_change', 'share', 'export',
      'add', 'remove', 'grant', 'revoke'
    );
  END IF;
END $$;
