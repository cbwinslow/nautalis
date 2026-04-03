export type TeamRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type PermissionScope = 'team' | 'project' | 'agent' | 'memory' | 'knowledge_base' | 'telemetry' | 'settings';
export type PermissionAction = 'read' | 'write' | 'delete' | 'admin' | 'share' | 'export' | 'import';
export type KbVisibility = 'public' | 'team' | 'project' | 'private';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  authId?: string;  // Supabase auth.users.id
  timezone: string;
  language: string;
  isActive: boolean;
  lastLoginAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  settings: Record<string, unknown>;
  maxMembers: number;
  maxProjects: number;
  maxStorageGb: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  invitedBy?: string;
  invitedAt: Date;
  joinedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  email?: string;
  name?: string;
}

export interface RolePermission {
  id: string;
  role: TeamRole;
  scope: PermissionScope;
  action: PermissionAction;
  granted: boolean;
}

export interface TeamPermission {
  id: string;
  teamId: string;
  userId: string;
  scope: PermissionScope;
  action: PermissionAction;
  granted: boolean;
  setBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceShare {
  id: string;
  teamId: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  targetTeamId?: string;
  actions: PermissionAction[];
  sharedBy?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface TeamActivity {
  id: string;
  userId: string;
  userName: string;
  agentTool: string;
  projectId: string;
  action: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface ConflictAlert {
  id: string;
  type: 'file_overlap' | 'topic_overlap' | 'resource_conflict';
  severity: 'low' | 'medium' | 'high';
  users: string[];
  details: {
    files?: string[];
    topics?: string[];
    description: string;
  };
  detectedAt: Date;
  resolved: boolean;
}
