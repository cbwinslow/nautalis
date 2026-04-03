export type EventType =
  | 'tool_use'
  | 'file_edit'
  | 'file_read'
  | 'file_write'
  | 'file_create'
  | 'file_delete'
  | 'command'
  | 'decision'
  | 'error'
  | 'conversation'
  | 'session_start'
  | 'session_end';

export interface AgentIdentity {
  toolName: string;
  toolVersion: string;
  instanceId: string;
  sessionId: string;
  agentName: string;
  userId: string;
}

export interface EventContext {
  teamId?: string;
  projectId: string;
  repoPath: string;
  repoUrl?: string;
  branch?: string;
  cwd: string;
  platform: string;
}

export interface ToolInput {
  command?: string;
  file_path?: string;
  old_string?: string;
  new_string?: string;
  content?: string;
  [key: string]: unknown;
}

export interface ToolOutput {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  content?: string;
  [key: string]: unknown;
}

export interface NautalisEvent {
  eventId: string;
  timestamp: Date;
  source: AgentIdentity;
  project: EventContext;
  type: EventType;
  toolName?: string;
  toolInput?: ToolInput;
  toolOutput?: ToolOutput;
  filesInvolved: string[];
  context: EventContext;
  extracted: {
    decisions: string[];
    errors: string[];
    topics: string[];
  };
  raw?: Record<string, unknown>;
}
