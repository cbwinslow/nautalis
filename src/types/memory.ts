import type { AgentIdentity, EventContext } from './event.js';

export type MemoryType =
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'decision'
  | 'lesson'
  | 'preference';

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'secret';

export interface MemoryContent {
  summary: string;
  detail?: string;
  filesInvolved: string[];
  commandsExec: string[];
  errorsSeen: string[];
  codeSnippets: string[];
}

export interface MemoryClassification {
  memoryType: MemoryType;
  blockLabel: string;
  topics: string[];
  confidence: number;
  importance: number;
  sensitivity: SensitivityLevel;
}

export interface MemoryRelationships {
  parentMemoryId?: string;
  supersedes: string[];
  contradicts: string[];
  supports: string[];
  tags: string[];
}

export interface MemoryLifecycle {
  ttl?: Date;
  decayRate: number;
  lastAccess: Date;
  accessCount: number;
  isStale: boolean;
}

export interface Memory {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  agentIdentity: AgentIdentity;
  context: EventContext;
  classification: MemoryClassification;
  content: MemoryContent;
  relationships: MemoryRelationships;
  lifecycle: MemoryLifecycle;
  embedding?: number[];
}

export interface MemoryQuery {
  query: string;
  projectId?: string;
  teamId?: string;
  agentToolName?: string;
  memoryType?: MemoryType;
  topics?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  minImportance?: number;
  minConfidence?: number;
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface MemoryQueryResult {
  memory: Memory;
  score: number;
  matchedTopics: string[];
  matchedFiles: string[];
}
