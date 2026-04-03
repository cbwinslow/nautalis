import type { NautalisEvent } from '../types/event.js';
import type { Memory, MemoryQuery, MemoryQueryResult } from '../types/memory.js';

export interface Store {
  // Lifecycle
  init(): Promise<void>;
  close(): Promise<void>;
  
  // Events
  insertEvent(event: NautalisEvent): Promise<string>;
  getEventsBySession(sessionId: string): Promise<NautalisEvent[]>;
  getEventsByProject(projectId: string, limit?: number): Promise<NautalisEvent[]>;
  
  // Memories
  insertMemory(memory: Memory): Promise<string>;
  getMemory(id: string): Promise<Memory | null>;
  queryMemories(query: MemoryQuery): Promise<MemoryQueryResult[]>;
  updateMemory(id: string, updates: Partial<Memory>): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  listMemories(filters?: { projectId?: string; memoryType?: string; limit?: number }): Promise<Memory[]>;
  
  // Vector operations
  insertEmbedding(memoryId: string, embedding: number[]): Promise<void>;
  searchEmbeddings(embedding: number[], limit?: number, filters?: Record<string, unknown>): Promise<{ memoryId: string; score: number }[]>;
  
  // Agents
  upsertAgent(agent: { id: string; toolName: string; toolVersion?: string; instanceId: string; agentName?: string; userId: string }): Promise<void>;
  
  // Projects
  upsertProject(project: { id: string; name?: string; repoPath: string; repoUrl?: string; teamId?: string }): Promise<void>;
  getProject(id: string): Promise<{ id: string; name?: string; repoPath: string; repoUrl?: string; teamId?: string } | null>;
  
  // Sessions
  upsertSession(session: { id: string; agentId: string; projectId?: string; branch?: string; startedAt: Date; status?: string }): Promise<void>;
  updateSession(id: string, updates: { endedAt?: Date; summary?: string; status?: string; eventCount?: number }): Promise<void>;
  
  // Stats
  getStats(): Promise<{
    totalEvents: number;
    totalMemories: number;
    totalAgents: number;
    totalProjects: number;
    totalSessions: number;
  }>;
}
