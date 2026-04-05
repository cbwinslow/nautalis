import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// General configuration
export const GeneralConfigSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  teamId: z.string().optional(),
});

// Database configuration
export const DatabaseConfigSchema = z.object({
  driver: z.enum(['postgres', 'supabase']),
  postgres: z.object({
    url: z.string().url(),
    maxConnections: z.number().int().positive().optional(),
  }).optional(),
  supabase: z.object({
    projectUrl: z.string().url(),
    serviceKey: z.string().min(1),
  }).optional(),
});

// Embedding configuration
export const EmbeddingConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'cohere', 'custom']),
  model: z.string().min(1),
  ollama: z.object({ url: z.string().url() }).optional(),
  openai: z.object({ apiKeyEnv: z.string(), model: z.string().optional() }).optional(),
  cohere: z.object({ apiKeyEnv: z.string(), model: z.string().optional() }).optional(),
  custom: z.object({
    baseUrl: z.string().url(),
    model: z.string(),
    apiKeyEnv: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
});

// LLM configuration
export const LLMConfigSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic', 'custom']),
  model: z.string().min(1),
  ollama: z.object({ url: z.string().url() }).optional(),
  openai: z.object({ apiKeyEnv: z.string(), model: z.string().optional() }).optional(),
  anthropic: z.object({ apiKeyEnv: z.string(), model: z.string().optional() }).optional(),
  custom: z.object({
    baseUrl: z.string().url(),
    model: z.string(),
    apiKeyEnv: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
});

// Guardrails configuration
export const GuardrailsConfigSchema = z.object({
  piiDetection: z.boolean().default(true),
  secretDetection: z.boolean().default(true),
  maxContextLines: z.number().int().positive().default(100),
  minRelevanceScore: z.number().min(0).max(1).default(0.7),
});

// Connector entry
export const ConnectorEntrySchema = z.object({
  type: z.string().min(1),
  enabled: z.boolean().default(true),
  sourceDirs: z.array(z.string()).default([]),
}).passthrough(); // Allow additional fields per connector type

// Rule config
export const RuleConfigSchema = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  action: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

// Main config schema
export const NautalisConfigSchema = z.object({
  general: GeneralConfigSchema,
  database: DatabaseConfigSchema,
  embeddings: EmbeddingConfigSchema,
  llm: LLMConfigSchema,
  connectors: z.array(ConnectorEntrySchema).default([]),
  guardrails: GuardrailsConfigSchema.default({}),
  rules: z.array(RuleConfigSchema).default([]),
  deployment: z.string().optional(),
});

// Tool input/output schemas
export const ToolInputSchema = z.object({
  command: z.string().optional(),
  file_path: z.string().optional(),
  old_string: z.string().optional(),
  new_string: z.string().optional(),
  content: z.string().optional(),
}).passthrough();

export const ToolOutputSchema = z.object({
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().optional(),
  error: z.string().optional(),
  content: z.string().optional(),
}).passthrough();

// Event source (agent identity)
export const AgentIdentitySchema = z.object({
  toolName: z.string(),
  toolVersion: z.string(),
  instanceId: z.string(),
  sessionId: z.string(),
  agentName: z.string(),
  userId: z.string(),
});

// Event context
export const EventContextSchema = z.object({
  teamId: z.string().optional(),
  projectId: z.string(),
  repoPath: z.string(),
  repoUrl: z.string().optional(),
  branch: z.string().optional(),
  cwd: z.string(),
  platform: z.string(),
});

// Extracted data
export const ExtractedDataSchema = z.object({
  decisions: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
});

// Nautalis event (raw incoming from connectors)
export const NautalisEventSchema = z.object({
  eventId: z.string().default(() => uuidv4()),
  timestamp: z.date(),
  source: AgentIdentitySchema,
  project: EventContextSchema,
  type: z.enum(['tool_use','file_edit','file_read','file_write','file_create','file_delete','command','decision','error','conversation','session_start','session_end']),
  toolName: z.string().optional(),
  toolInput: ToolInputSchema.optional(),
  toolOutput: ToolOutputSchema.optional(),
  filesInvolved: z.array(z.string()).default([]),
  context: EventContextSchema,
  extracted: ExtractedDataSchema,
  raw: z.any().optional(),
});

// Memory classification
export const MemoryClassificationSchema = z.object({
  memoryType: z.enum(['episodic', 'semantic', 'procedural', 'decision', 'lesson', 'preference']).default('episodic'),
  blockLabel: z.string().optional(),
  topics: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1).default(0.5),
  confidence: z.number().min(0).max(1).default(0.8),
  sensitivity: z.enum(['public', 'internal', 'confidential', 'secret']).default('internal'),
});

// Memory lifecycle
export const MemoryLifecycleSchema = z.object({
  ttl: z.date().optional(),
  decayRate: z.number().min(0).max(1).default(0.01),
  lastAccess: z.date().default(() => new Date()),
  accessCount: z.number().int().nonnegative().default(0),
  isStale: z.boolean().default(false),
});

// Memory relationships
export const MemoryRelationshipsSchema = z.object({
  parentMemoryId: z.string().optional(),
  supersedes: z.array(z.string()).default([]),
  contradicts: z.array(z.string()).default([]),
  supports: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

// Memory content
export const MemoryContentSchema = z.object({
  summary: z.string().min(1),
  detail: z.string().optional(),
  filesInvolved: z.array(z.string()).default([]),
  commandsExec: z.array(z.string()).default([]),
  errorsSeen: z.array(z.string()).default([]),
  codeSnippets: z.array(z.string()).default([]),
});

// Full Memory (enriched, stored)
export const MemorySchema = z.object({
  id: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  agentIdentity: AgentIdentitySchema,
  context: EventContextSchema,
  classification: MemoryClassificationSchema,
  content: MemoryContentSchema,
  relationships: MemoryRelationshipsSchema,
  lifecycle: MemoryLifecycleSchema,
  embedding: z.array(z.number()).optional(),
});

// Knowledge Base entry
export const KBEntrySchema = z.object({
  id: z.string().optional(),
  teamId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  contentType: z.enum(['markdown', 'html', 'plain_text', 'code']).default('markdown'),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  visibility: z.enum(['public', 'team', 'project', 'private']).default('team'),
  version: z.number().int().nonnegative().default(0),
  parentVersionId: z.string().optional(),
  source: z.enum(['manual', 'auto_extracted', 'ai_generated', 'imported']).default('manual'),
  sourceAgentId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  isPublished: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  viewCount: z.number().int().nonnegative().default(0),
  lastViewedAt: z.date().nullable().optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Team
export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  ownerId: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  isActive: z.boolean().default(true),
  settings: z.record(z.any()).optional(),
});

// Team member
export const TeamMemberSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'manager', 'member', 'viewer']),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

// Project
export const ProjectSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  repoPath: z.string().optional(),
  repoUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

// Agent
export const AgentSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  toolName: z.string().min(1),
  toolVersion: z.string().optional(),
  instanceId: z.string().min(1),
  agentName: z.string().optional(),
  isActive: z.boolean().default(true),
  lastSeenAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

// Session
export const SessionSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  teamId: z.string().min(1),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  branch: z.string().optional(),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  summary: z.string().optional(),
  status: z.enum(['active', 'completed', 'error']).default('active'),
  eventCount: z.number().int().nonnegative().optional(),
});

// Type exports
export type NautalisConfigType = z.infer<typeof NautalisConfigSchema>;
export type NautalisEventType = z.infer<typeof NautalisEventSchema>;
export type MemoryType = z.infer<typeof MemorySchema>;
export type KBEntryType = z.infer<typeof KBEntrySchema>;
export type TeamType = z.infer<typeof TeamSchema>;
export type TeamMemberType = z.infer<typeof TeamMemberSchema>;
export type ProjectType = z.infer<typeof ProjectSchema>;
export type AgentType = z.infer<typeof AgentSchema>;
export type SessionType = z.infer<typeof SessionSchema>;
