import type { NautalisEvent } from '../types/event.js';
import type { Memory, MemoryQuery, MemoryQueryResult } from '../types/memory.js';
import type { KnowledgeBaseEntry, KnowledgeBaseQuery } from '../types/knowledge-base.js';
import type { Team, TeamMember, User } from '../types/team.js';
import type { PermissionCheck } from '../types/permissions.js';

export interface Store {
  // Lifecycle
  init(): Promise<void>;
  close(): Promise<void>;

  // Users & Auth
  createUser(user: { email: string; name?: string; authId?: string }): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;

   // Teams
   createTeam(team: { name: string; slug: string; ownerId: string }): Promise<Team>;
   getTeam(id: string, options?: { userId?: string }): Promise<Team | null>;
   getTeamBySlug(slug: string): Promise<Team | null>;
   getTeamsForUser(userId: string): Promise<Team[]>;
   updateTeam(id: string, updates: Partial<Team>, options?: { userId?: string }): Promise<void>;

   // Team Members
   addTeamMember(teamId: string, userId: string, role: string, options?: { actingUserId?: string }): Promise<TeamMember>;
   removeTeamMember(teamId: string, userId: string, options?: { actingUserId?: string }): Promise<void>;
   updateMemberRole(teamId: string, userId: string, role: string, options?: { actingUserId?: string }): Promise<void>;
   getTeamMembers(teamId: string, options?: { userId?: string }): Promise<TeamMember[]>;

  // Permissions
  checkPermission(userId: string, teamId: string, scope: string, action: string): Promise<boolean>;
  grantPermission(teamId: string, userId: string, scope: string, action: string, granted: boolean): Promise<void>;
  shareResource(teamId: string, resourceType: string, resourceId: string, targetUserId: string, actions: string[]): Promise<void>;

   // Projects
   createProject(project: { teamId: string; name: string; slug?: string; repoPath?: string; repoUrl?: string }, options?: { userId?: string }): Promise<string>;
   getProject(id: string, options?: { userId?: string }): Promise<any>;
   getProjectsForTeam(teamId: string, options?: { userId?: string }): Promise<any[]>;

   // Agents
   upsertAgent(agent: { teamId: string; userId?: string; projectId?: string; toolName: string; toolVersion?: string; instanceId: string; agentName?: string }, options?: { userId?: string }): Promise<string>;
   getAgentsForTeam(teamId: string, options?: { userId?: string }): Promise<any[]>;

   // Sessions
   createSession(session: { id: string; agentId: string; teamId: string; projectId?: string; userId?: string; branch?: string }, options?: { userId?: string }): Promise<void>;
   updateSession(id: string, updates: { endedAt?: Date; summary?: string; status?: string; eventCount?: number }, options?: { userId?: string; teamId?: string }): Promise<void>;

  // Events
  insertEvent(event: NautalisEvent): Promise<string>;
  getEventsBySession(sessionId: string, limit?: number): Promise<NautalisEvent[]>;
  getEventsByTeam(teamId: string, options?: { since?: Date; until?: Date; type?: string; limit?: number }): Promise<NautalisEvent[]>;

   // Memories
   insertMemory(memory: Memory, options?: { userId?: string; teamId?: string }): Promise<string>;
   getMemory(id: string, options?: { userId?: string; teamId?: string }): Promise<Memory | null>;
   queryMemories(query: MemoryQuery & { userId?: string; teamId?: string }): Promise<MemoryQueryResult[]>;
   updateMemory(id: string, updates: Partial<Memory>, options?: { userId?: string; teamId?: string }): Promise<void>;
   deleteMemory(id: string, options?: { userId?: string; teamId?: string }): Promise<void>;
    listMemories(teamId: string, filters?: { projectId?: string; memoryType?: string; limit?: number; userId?: string }): Promise<Memory[]>;
    findSimilarMemories(embedding: number[], teamId: string, limit?: number, minScore?: number, options?: { userId?: string }): Promise<MemoryQueryResult[]>;
    getMemoriesByIds(ids: string[], options: { teamId: string; userId?: string }): Promise<Memory[]>;

  // Vector operations
  insertEmbedding(memoryId: string, embedding: number[], options?: { userId?: string }): Promise<void>;

  // Knowledge Base
  createKnowledgeBase(entry: KnowledgeBaseEntry, options?: { userId?: string }): Promise<string>;
  getKnowledgeBase(id: string, options?: { userId?: string }): Promise<KnowledgeBaseEntry | null>;
  queryKnowledgeBase(query: KnowledgeBaseQuery & { userId?: string; teamId?: string }): Promise<KnowledgeBaseEntry[]>;
  updateKnowledgeBase(id: string, updates: Partial<KnowledgeBaseEntry>, options?: { userId?: string }): Promise<void>;
  deleteKnowledgeBase(id: string, options?: { userId?: string }): Promise<void>;
  searchKnowledgeBase(teamId: string, query: string, embedding?: number[], options?: { category?: string; limit?: number; userId?: string }): Promise<KnowledgeBaseEntry[]>;

  // Telemetry
  insertTelemetry(entry: { teamId: string; signalType: string; name: string; attributes?: Record<string, unknown>; value?: number; message?: string; traceId?: string; spanId?: string; startTime: Date; endTime?: Date }): Promise<void>;

  // Audit
  logAudit(teamId: string, userId: string, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>): Promise<void>;

  // Stats
  getTeamDashboard(teamId: string): Promise<Record<string, number>>;
  getStats(): Promise<{ totalUsers: number; totalTeams: number; totalProjects: number; totalAgents: number; totalMemories: number; totalEvents: number }>;
}
