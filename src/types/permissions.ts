import type { TeamRole, PermissionScope, PermissionAction } from './team.js';

export interface PermissionCheck {
  userId: string;
  teamId: string;
  scope: PermissionScope;
  action: PermissionAction;
}

export interface PermissionGrant {
  teamId: string;
  userId: string;
  scope: PermissionScope;
  action: PermissionAction;
  granted: boolean;
}

export interface PermissionMatrix {
  role: TeamRole;
  permissions: {
    [scope in PermissionScope]?: PermissionAction[];
  };
}

export const DEFAULT_ROLE_PERMISSIONS: PermissionMatrix[] = [
  {
    role: 'owner',
    permissions: {
      team: ['admin', 'read', 'write', 'delete'],
      project: ['admin', 'read', 'write', 'delete'],
      agent: ['admin', 'read', 'write', 'delete'],
      memory: ['read', 'write', 'delete', 'export', 'share'],
      knowledge_base: ['read', 'write', 'delete', 'share'],
      telemetry: ['read', 'export'],
      settings: ['admin', 'read', 'write'],
    },
  },
  {
    role: 'admin',
    permissions: {
      team: ['read', 'write'],
      project: ['admin', 'read', 'write', 'delete'],
      agent: ['admin', 'read', 'write', 'delete'],
      memory: ['read', 'write', 'delete', 'export', 'share'],
      knowledge_base: ['read', 'write', 'delete', 'share'],
      telemetry: ['read', 'export'],
      settings: ['read', 'write'],
    },
  },
  {
    role: 'manager',
    permissions: {
      team: ['read'],
      project: ['admin', 'read', 'write', 'delete'],
      agent: ['read', 'write'],
      memory: ['read', 'write', 'delete', 'export', 'share'],
      knowledge_base: ['read', 'write', 'share'],
      telemetry: ['read'],
      settings: ['read'],
    },
  },
  {
    role: 'member',
    permissions: {
      project: ['read', 'write'],
      agent: ['read', 'write'],
      memory: ['read', 'write', 'export'],
      knowledge_base: ['read', 'write'],
      telemetry: ['read'],
    },
  },
  {
    role: 'viewer',
    permissions: {
      project: ['read'],
      agent: ['read'],
      memory: ['read'],
      knowledge_base: ['read'],
      telemetry: ['read'],
    },
  },
];
