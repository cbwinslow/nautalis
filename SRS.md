# Nautalis — Software Requirements Specification

**Version**: 1.0.0  
**Status**: Draft  
**Date**: 2026-04-03

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for Nautalis, a Universal AI Agent Memory & Orchestration Platform. It serves as the definitive reference for what the system must do, how it must perform, and how it must be built.

### 1.2 Scope

Nautalis provides a shared memory infrastructure for AI coding agents, enabling:

- **Cross-agent memory aggregation** — Collecting and unifying memories from multiple AI coding tools
- **Intelligent retrieval** — RAG-powered semantic search across all stored memories
- **Context injection** — Delivering synthesized, relevant context to any querying agent
- **Team collaboration** — Shared memory pools with access control for teams
- **Full observability** — OpenTelemetry instrumentation for traces, logs, and metrics

The system targets solo developers, small teams, and enterprise organizations, with deployment options ranging from zero-cost local operation to managed cloud infrastructure.

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|-----------|
| **Agent** | An AI coding tool or autonomous system (Claude Code, Kilo Code, Cursor, etc.) |
| **Memory** | A stored unit of agent activity, enriched with metadata and embeddings |
| **Connector** | A pluggable integration that captures events from a specific AI agent |
| **RAG** | Retrieval-Augmented Generation — using retrieved context to enhance AI responses |
| **Embedding** | A vector representation of text for semantic similarity search |
| **OTEL** | OpenTelemetry — observability framework for traces, logs, and metrics |
| **MCP** | Model Context Protocol — standard protocol for AI agent context exchange |
| **TUI** | Terminal User Interface |

### 1.4 References

- LlamaIndex.TS Documentation: https://ts.llamaindex.ai/
- OpenTelemetry Specification: https://opentelemetry.io/docs/
- Model Context Protocol: https://modelcontextprotocol.io/
- Conventional Commits: https://www.conventionalcommits.org/

---

## 2. System Overview

### 2.1 System Context

```
┌──────────────────────────────────────────────────────────────────────┐
│                         External Systems                              │
├─────────────┬─────────────┬─────────────┬─────────────┬──────────────┤
│ Claude Code │  Kilo Code  │   Cursor    │  Windsurf   │ Custom Agents│
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────┬───────┘
       │              │             │             │             │
       └──────────────┴─────────────┴─────────────┴─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │     Nautalis Core     │
                    │  ┌─────────────────┐  │
                    │  │  Connector Layer │  │
                    │  └────────┬────────┘  │
                    │  ┌────────┴────────┐  │
                    │  │  Memory Engine  │  │
                    │  └────────┬────────┘  │
                    │  ┌────────┴────────┐  │
                    │  │  Storage Layer  │  │
                    │  └────────┬────────┘  │
                    │  ┌────────┴────────┐  │
                    │  │  Context Layer  │  │
                    │  └─────────────────┘  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Observability (OTEL) │
                    └───────────────────────┘
```

### 2.2 User Classes and Characteristics

| User Class | Description | Primary Needs |
|------------|-------------|---------------|
| **Solo Developer** | Individual using multiple AI coding tools | Personal memory, zero-cost setup, offline operation |
| **Team Lead** | Managing a team of developers using AI tools | Team memory visibility, cross-agent knowledge sharing |
| **Team Member** | Developer on a team using AI tools | Shared context, team memory access, personal memory |
| **Enterprise Admin** | IT administrator for organization-wide deployment | Compliance, audit trails, access control, scalability |
| **AI Agent** | AI coding tool connected to Nautalis | Context retrieval, memory storage, real-time sync |
| **Plugin Developer** | Developer building custom connectors | Connector SDK, documentation, testing tools |

---

## 3. System Features

### 3.1 Connector System

#### 3.1.1 Description

The connector system provides pluggable integrations for AI coding tools. Each connector captures events from its associated agent and translates them into the Nautalis memory format.

#### 3.1.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CON-001 | The system shall provide a connector registry for managing connector lifecycle | Must Have |
| CON-002 | Connectors shall auto-register upon import via side-effect registration | Must Have |
| CON-003 | Each connector shall implement the `Connector` interface with required methods | Must Have |
| CON-004 | The system shall support hot-reloading of connectors without restart | Should Have |
| CON-005 | Connectors shall report health status at configurable intervals | Must Have |
| CON-006 | The system shall provide a connector SDK for building custom connectors | Must Have |
| CON-007 | Connectors shall support event streaming via async iterables | Must Have |
| CON-008 | The system shall validate connector events against the memory schema | Must Have |
| CON-009 | Connectors shall support configurable event filtering | Should Have |
| CON-010 | The system shall provide built-in connectors for Claude Code, Kilo Code, and Cursor | Must Have |

#### 3.1.3 Connector Interface

```typescript
interface Connector {
  /** Unique identifier for this connector */
  id: string;

  /** Human-readable name */
  name: string;

  /** Connector version */
  version: string;

  /** Supported agent types */
  agentTypes: string[];

  /**
   * Initialize the connector with configuration
   * @param config - Connector-specific configuration
   */
  initialize(config: ConnectorConfig): Promise<void>;

  /**
   * Capture a single event and convert to memory record
   * @param event - Raw agent event
   * @returns Enriched memory record
   */
  captureEvent(event: AgentEvent): Promise<MemoryRecord>;

  /**
   * Stream events from the agent as an async iterable
   * @yields Agent events as they occur
   */
  streamEvents(): AsyncIterable<AgentEvent>;

  /**
   * Check connector health
   * @returns Health status with details
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Gracefully shut down the connector
   */
  shutdown(): Promise<void>;
}
```

#### 3.1.4 Supported Connectors (v1.0)

| Connector | Agent | Event Types | Status |
|-----------|-------|-------------|--------|
| `claude-code` | Claude Code | commands, file_edits, decisions, errors, context | Planned |
| `kilo-code` | Kilo Code | commands, file_edits, decisions, errors, context, tool_calls | Planned |
| `cursor` | Cursor | completions, chat, edits, context | Planned |
| `windsurf` | Windsurf | cascade_steps, file_ops, decisions | Planned |
| `custom` | Any | configurable | Planned |

### 3.2 Memory Engine

#### 3.2.1 Description

The memory engine is the core of Nautalis, powered by LlamaIndex.TS. It handles memory ingestion, enrichment, embedding generation, classification, and retrieval.

#### 3.2.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| MEM-001 | The system shall ingest memory records from connectors | Must Have |
| MEM-002 | The system shall validate all memory records against the schema before storage | Must Have |
| MEM-003 | The system shall generate embeddings for all memory content | Must Have |
| MEM-004 | The system shall support multiple embedding providers (Ollama, OpenAI, etc.) | Must Have |
| MEM-005 | The system shall automatically classify memories by category and tags | Must Have |
| MEM-006 | The system shall extract relationships between memories | Should Have |
| MEM-007 | The system shall support semantic search across all memories | Must Have |
| MEM-008 | The system shall support hybrid search (semantic + keyword + metadata filters) | Must Have |
| MEM-009 | The system shall support temporal queries (time-range filtering) | Must Have |
| MEM-010 | The system shall support agent-specific queries | Must Have |
| MEM-011 | The system shall detect and redact PII before storage | Must Have |
| MEM-012 | The system shall support memory expiration and archival | Should Have |
| MEM-013 | The system shall support batch ingestion for performance | Should Have |
| MEM-014 | The system shall provide confidence scoring for retrieval results | Must Have |
| MEM-015 | The system shall support memory updates and versioning | Should Have |

#### 3.2.3 Memory Enrichment Pipeline

```
Raw Event
    │
    ▼
┌─────────────┐
│ Validation  │  Schema validation, required fields check
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PII Scan    │  Detect and redact personally identifiable information
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Classify    │  Auto-classify by category, generate tags
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Embed       │  Generate vector embedding via configured provider
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Relate      │  Find and link related existing memories
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Score       │  Calculate importance and confidence scores
└──────┬──────┘
       │
       ▼
  Memory Record
```

### 3.3 Storage Backends

#### 3.3.1 Description

Nautalis supports multiple storage backends, from zero-cost local SQLite to enterprise PostgreSQL/Supabase.

#### 3.3.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| STO-001 | The system shall support SQLite as a storage backend | Must Have |
| STO-002 | The system shall support PostgreSQL as a storage backend | Must Have |
| STO-003 | The system shall support vector storage for embeddings (pgvector for PostgreSQL) | Must Have |
| STO-004 | The system shall provide a storage interface for custom backends | Must Have |
| STO-005 | The system shall support database migrations | Must Have |
| STO-006 | The system shall support connection pooling for PostgreSQL | Should Have |
| STO-007 | The system shall support read replicas for PostgreSQL | Could Have |
| STO-008 | The system shall encrypt sensitive fields at rest | Should Have |
| STO-009 | The system shall support backup and restore operations | Should Have |
| STO-010 | SQLite backend shall operate without external dependencies | Must Have |

#### 3.3.3 Storage Interface

```typescript
interface StorageBackend {
  /** Initialize the storage backend */
  initialize(config: StorageConfig): Promise<void>;

  /** Store a memory record */
  store(memory: MemoryRecord): Promise<void>;

  /** Retrieve a memory by ID */
  getById(id: string): Promise<MemoryRecord | null>;

  /** Query memories with filters */
  query(params: MemoryQuery): Promise<MemoryRecord[]>;

  /** Semantic search using embeddings */
  semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;

  /** Update a memory record */
  update(id: string, updates: Partial<MemoryRecord>): Promise<void>;

  /** Delete a memory record */
  delete(id: string): Promise<void>;

  /** Get memory count */
  count(filters?: MemoryFilters): Promise<number>;

  /** Run migrations */
  migrate(): Promise<void>;

  /** Close connections */
  close(): Promise<void>;
}
```

### 3.4 Embedding Providers

#### 3.4.1 Description

The system supports multiple embedding providers, with Ollama as the default for zero-cost local operation.

#### 3.4.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| EMB-001 | The system shall support Ollama as an embedding provider | Must Have |
| EMB-002 | The system shall support OpenAI embeddings as an alternative | Must Have |
| EMB-003 | The system shall provide an embedding provider interface for custom providers | Must Have |
| EMB-004 | The system shall support configurable embedding models | Must Have |
| EMB-005 | The system shall batch embedding requests for efficiency | Should Have |
| EMB-006 | The system shall cache embeddings to avoid regeneration | Should Have |
| EMB-007 | The system shall fall back gracefully if the primary provider is unavailable | Must Have |
| EMB-008 | The system shall track embedding generation latency as a metric | Must Have |

#### 3.4.3 Supported Embedding Models

| Provider | Model | Dimensions | Cost | Notes |
|----------|-------|-----------|------|-------|
| Ollama | nomic-embed-text | 768 | Free | Default, local |
| Ollama | mxbai-embed-large | 1024 | Free | Higher quality |
| OpenAI | text-embedding-3-small | 1536 | Paid | Cloud |
| OpenAI | text-embedding-3-large | 3072 | Paid | Highest quality |

### 3.5 OpenTelemetry Observability

#### 3.5.1 Description

Full OpenTelemetry instrumentation provides visibility into system behavior, performance, and health.

#### 3.5.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| TEL-001 | The system shall generate distributed traces for all operations | Must Have |
| TEL-002 | The system shall emit structured logs with memory context | Must Have |
| TEL-003 | The system shall collect and export metrics | Must Have |
| TEL-004 | The system shall support OTLP export protocol | Must Have |
| TEL-005 | The system shall support multiple exporters (console, file, OTLP) | Must Have |
| TEL-006 | The system shall trace connector event processing end-to-end | Must Have |
| TEL-007 | The system shall trace memory ingestion pipeline | Must Have |
| TEL-008 | The system shall trace context retrieval queries | Must Have |
| TEL-009 | The system shall collect memory operation metrics (count, latency, errors) | Must Have |
| TEL-010 | The system shall collect embedding generation metrics | Must Have |
| TEL-011 | The system shall collect storage backend metrics | Must Have |
| TEL-012 | The system shall collect connector health metrics | Must Have |
| TEL-013 | The system shall support benchmarking pipelines | Should Have |
| TEL-014 | The system shall expose a health check endpoint | Must Have |
| TEL-015 | The system shall support configurable sampling rates | Should Have |

#### 3.5.3 Standard Metrics

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|--------|
| `nautalis.memory.operations_total` | Counter | Total memory operations | `operation`, `agent`, `status` |
| `nautalis.memory.query_duration_ms` | Histogram | Query latency | `query_type`, `agent` |
| `nautalis.memory.count` | Gauge | Current memory count | `agent`, `category` |
| `nautalis.embeddings.generated_total` | Counter | Total embeddings generated | `provider`, `model` |
| `nautalis.embeddings.duration_ms` | Histogram | Embedding generation latency | `provider`, `model` |
| `nautalis.connector.health` | Gauge | Connector health status | `connector`, `status` |
| `nautalis.connector.events_total` | Counter | Total events processed | `connector`, `event_type` |
| `nautalis.storage.operations_total` | Counter | Total storage operations | `backend`, `operation`, `status` |
| `nautalis.storage.duration_ms` | Histogram | Storage operation latency | `backend`, `operation` |
| `nautalis.pii.detected_total` | Counter | PII detections | `pii_type`, `action` |

#### 3.5.4 Standard Trace Spans

| Span Name | Description | Key Attributes |
|-----------|-------------|----------------|
| `memory.store` | Memory ingestion | `memory.id`, `agent.id`, `content.length` |
| `memory.query` | Memory retrieval | `query.type`, `result.count`, `latency` |
| `memory.enrich` | Enrichment pipeline | `steps.completed`, `pii.detected` |
| `embedding.generate` | Embedding generation | `provider`, `model`, `input.length` |
| `connector.capture` | Event capture | `connector.id`, `event.type` |
| `connector.stream` | Event streaming | `connector.id`, `events.count` |
| `context.synthesize` | Context synthesis | `agent.id`, `context.size`, `sources` |

### 3.6 Orchestration Intelligence

#### 3.6.1 Description

The orchestration layer provides intelligent context synthesis, agent coordination, and rule-based behavior.

#### 3.6.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ORC-001 | The system shall synthesize relevant context from cross-agent memories | Must Have |
| ORC-002 | The system shall support configurable context window sizes | Must Have |
| ORC-003 | The system shall rank context by relevance, recency, and importance | Must Have |
| ORC-004 | The system shall support agent-specific context profiles | Should Have |
| ORC-005 | The system shall support team memory pools with access control | Must Have |
| ORC-006 | The system shall support role-based access control for team features | Should Have |
| ORC-007 | The system shall support orchestration rules for automated behavior | Should Have |
| ORC-008 | The system shall support predictive context (anticipating agent needs) | Could Have |
| ORC-009 | The system shall support conflict resolution for overlapping memories | Should Have |
| ORC-010 | The system shall provide context injection via CLI, API, and MCP | Must Have |

#### 3.6.3 Context Synthesis Pipeline

```
Query
  │
  ▼
┌─────────────┐
│ Parse Query │  Extract intent, entities, filters
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Retrieve    │  Semantic + keyword + metadata search
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Rank        │  Score by relevance, recency, importance
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Synthesize  │  Combine, deduplicate, summarize
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Format      │  Format for target agent's context window
└──────┬──────┘
       │
       ▼
  Context Block
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Memory ingestion latency (excluding embedding) | < 100ms (p95) |
| NFR-002 | Context retrieval latency | < 500ms (p95) |
| NFR-003 | Semantic search latency (100k memories) | < 1s (p95) |
| NFR-004 | Embedding generation latency (local, Ollama) | < 200ms per memory |
| NFR-005 | System startup time (SQLite + Ollama) | < 5s |
| NFR-006 | CLI command response time | < 200ms |
| NFR-007 | API response time (healthy system) | < 300ms (p95) |

### 4.2 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-008 | Maximum memories supported (SQLite) | 100,000+ |
| NFR-009 | Maximum memories supported (PostgreSQL) | 10,000,000+ |
| NFR-010 | Concurrent connectors supported | 10+ |
| NFR-011 | Concurrent queries supported | 50+ |
| NFR-012 | Maximum memory content size | 100KB per memory |

### 4.3 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-013 | System availability (local deployment) | 99.9% |
| NFR-014 | Data durability | No data loss on normal shutdown |
| NFR-015 | Graceful degradation | System functions with degraded embedding provider |
| NFR-016 | Recovery time after crash | < 30s |

### 4.4 Zero-Cost Operation

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-017 | Default deployment cost | $0/month |
| NFR-018 | Embedding generation cost (default) | $0 (local Ollama) |
| NFR-019 | Storage cost (default) | $0 (local SQLite) |
| NFR-020 | Observability cost (default) | $0 (local OTLP) |

### 4.5 Offline Capability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-021 | Core functionality without internet | Must work |
| NFR-022 | Embedding generation without internet | Must work (Ollama local) |
| NFR-023 | Storage without internet | Must work (SQLite local) |
| NFR-024 | Graceful degradation for cloud features | Must degrade gracefully |

### 4.6 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-025 | No hardcoded secrets | Must enforce |
| NFR-026 | PII detection and redaction | Must enforce |
| NFR-027 | Input validation on all external input | Must enforce |
| NFR-028 | Dependency security audit | Must pass |
| NFR-029 | Secret scanning in CI | Must pass |

### 4.7 Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-030 | Zero-config setup | `bun run start` works out of the box |
| NFR-031 | CLI help documentation | All commands documented |
| NFR-032 | Error messages | Actionable, human-readable |
| NFR-033 | Configuration | YAML with sensible defaults |

---

## 5. Data Model

### 5.1 Memory Record

The core data entity in Nautalis. Every memory carries comprehensive metadata.

```typescript
interface MemoryRecord {
  // Identity
  id: string;                    // UUID v4
  agentId: string;               // Unique agent identifier
  agentType: string;             // Agent type (claude-code, kilo-code, etc.)
  agentVersion?: string;         // Agent software version
  userId: string;                // Human user identifier
  sessionId: string;             // Session identifier

  // Context
  project: string;               // Project/repository name
  workspace: string;             // Working directory
  files: string[];               // Files involved
  language: string[];            // Programming languages
  framework: string[];           // Frameworks in use
  branch?: string;               // Git branch

  // Classification
  category: MemoryCategory;      // Type of memory
  tags: string[];                // Auto-generated and manual tags
  confidence: number;            // 0.0–1.0
  importance: MemoryImportance;  // low, medium, high, critical
  sensitivity: MemorySensitivity;// public, internal, confidential, secret

  // Content
  summary: string;               // Human-readable summary
  detail: string;                // Full content with context
  embedding: number[];           // Vector embedding
  embeddingModel: string;        // Model used for embedding
  source: Record<string, unknown>; // Raw source data

  // Relationships
  relatedMemories: string[];     // IDs of related memories
  parentMemoryId?: string;       // Parent memory (hierarchical)
  derivedFrom?: string[];        // Source memories
  supersedes?: string[];         // Superseded memories

  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;              // Optional expiration
  accessCount: number;
  lastAccessedAt?: Date;
  status: MemoryStatus;          // active, archived, expired, deleted

  // PII
  piiScan: PIIScanResult;        // PII detection results
}
```

### 5.2 Enums

```typescript
enum MemoryCategory {
  DECISION = 'decision',         // Architectural or implementation decision
  DISCOVERY = 'discovery',       // Pattern or insight discovered
  ERROR = 'error',               // Error encountered and resolution
  PATTERN = 'pattern',           // Code pattern or best practice
  COMMAND = 'command',           // Command executed
  CONTEXT = 'context',           // Contextual information
  CONVERSATION = 'conversation', // Chat or discussion summary
  FILE_CHANGE = 'file_change',   // File modification
  TOOL_CALL = 'tool_call',       // Tool or function call
}

enum MemoryImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

enum MemorySensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
}

enum MemoryStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}
```

### 5.3 PII Scan Result

```typescript
interface PIIScanResult {
  scanned: boolean;              // Whether scan was performed
  detected: boolean;             // Whether PII was found
  types: PIIType[];              // Types of PII detected
  redactedContent: string;       // Content with PII redacted
  encryptedOriginal?: string;    // Encrypted original (if stored)
  scanTimestamp: Date;
}

enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  PASSWORD = 'password',
  API_KEY = 'api_key',
  TOKEN = 'token',
  IP_ADDRESS = 'ip_address',
}
```

### 5.4 Agent Event (Connector Input)

```typescript
interface AgentEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  agentId: string;
  agentType: string;
  userId: string;
  sessionId: string;
  payload: Record<string, unknown>;
  metadata: {
    project?: string;
    workspace?: string;
    files?: string[];
    language?: string[];
    [key: string]: unknown;
  };
}

enum EventType {
  COMMAND = 'command',
  FILE_EDIT = 'file_edit',
  DECISION = 'decision',
  ERROR = 'error',
  CONTEXT = 'context',
  TOOL_CALL = 'tool_call',
  CHAT = 'chat',
  CUSTOM = 'custom',
}
```

### 5.5 Database Schema (SQLite)

```sql
-- Core memories table
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  agent_version TEXT,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  workspace TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  importance TEXT NOT NULL DEFAULT 'medium',
  sensitivity TEXT NOT NULL DEFAULT 'public',
  embedding_model TEXT,
  source TEXT,  -- JSON
  parent_memory_id TEXT REFERENCES memories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  pii_detected INTEGER NOT NULL DEFAULT 0,
  pii_types TEXT  -- JSON array
);

-- Embeddings table (separate for efficient vector operations)
CREATE TABLE memory_embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id),
  embedding BLOB NOT NULL,  -- Serialized float32 array
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Tags table (many-to-many)
CREATE TABLE memory_tags (
  memory_id TEXT REFERENCES memories(id),
  tag TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Files table (many-to-many)
CREATE TABLE memory_files (
  memory_id TEXT REFERENCES memories(id),
  file_path TEXT NOT NULL,
  PRIMARY KEY (memory_id, file_path),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Relationships table (many-to-many)
CREATE TABLE memory_relationships (
  source_id TEXT REFERENCES memories(id),
  target_id TEXT REFERENCES memories(id),
  relationship_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  PRIMARY KEY (source_id, target_id, relationship_type),
  FOREIGN KEY (source_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Agents table
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  event_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_project ON memories(project);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_status ON memories(status);
CREATE INDEX idx_memories_created ON memories(created_at);
CREATE INDEX idx_memories_importance ON memories(importance);
CREATE INDEX idx_memories_sensitivity ON memories(sensitivity);
CREATE INDEX idx_memories_parent ON memories(parent_memory_id);
CREATE INDEX idx_memory_tags_tag ON memory_tags(tag);
CREATE INDEX idx_memory_files_path ON memory_files(file_path);
```

---

## 6. Interface Specifications

### 6.1 CLI (commander.js)

#### 6.1.1 Commands

```
nautalis <command> [options]

Commands:
  start [options]              Start the Nautalis server
  stop                         Stop the Nautalis server
  status                       Show system status

  memory <action>              Memory operations
    memory store [options]     Store a memory
    memory query <query>       Query memories
    memory get <id>            Get a memory by ID
    memory list [options]      List memories
    memory delete <id>         Delete a memory
    memory count [options]     Count memories

  agent <action>               Agent operations
    agent list                 List registered agents
    agent status <id>          Show agent status
    agent context <id> [opts]  Get context for an agent

  connector <action>           Connector operations
    connector list             List available connectors
    connector status <id>      Show connector status
    connector enable <id>      Enable a connector
    connector disable <id>     Disable a connector

  telemetry <action>           Telemetry operations
    telemetry status           Show telemetry status
    telemetry metrics          Show current metrics
    telemetry traces           Show recent traces
    telemetry logs [options]   Show logs

  team <action>                Team operations
    team list                  List team members
    team add <user>            Add a team member
    team remove <user>         Remove a team member
    team pools                 List memory pools
    team pool create <name>    Create a memory pool

  config <action>              Configuration
    config show                Show current configuration
    config get <key>           Get a config value
    config set <key> <value>   Set a config value

Options:
  -c, --config <path>          Configuration file path
  -v, --version                Show version
  -h, --help                   Show help
  --verbose                    Enable verbose output
  --json                       Output as JSON
```

#### 6.1.2 Example Usage

```bash
# Start with defaults
nautalis start

# Store a memory
nautalis memory store \
  --agent kilo-code \
  --content "Discovered auth pattern in src/auth.ts" \
  --category discovery \
  --project my-app

# Query memories
nautalis memory query "what did I learn about authentication?"

# Get context for an agent
nautalis agent context kilo-code --project my-app --limit 10

# Check system status
nautalis status --json
```

### 6.2 REST API (Hono)

#### 6.2.1 Endpoints

```
Base URL: http://localhost:3456/api/v1

Memory:
  POST   /memories                    Create a memory
  GET    /memories                    List/query memories
  GET    /memories/:id                Get a memory
  PUT    /memories/:id                Update a memory
  DELETE /memories/:id                Delete a memory
  POST   /memories/search             Semantic search
  GET    /memories/count              Count memories

Agents:
  GET    /agents                      List agents
  GET    /agents/:id                  Get agent details
  GET    /agents/:id/context          Get context for agent
  POST   /agents/:id/context          Inject context for agent

Connectors:
  GET    /connectors                  List connectors
  GET    /connectors/:id              Get connector details
  GET    /connectors/:id/health       Health check
  POST   /connectors/:id/events       Submit events (streaming)

Telemetry:
  GET    /telemetry/metrics           Current metrics
  GET    /telemetry/health            System health
  GET    /telemetry/status            Telemetry status

Team:
  GET    /team/members                List team members
  POST   /team/members                Add team member
  DELETE /team/members/:id            Remove team member
  GET    /team/pools                  List memory pools
  POST   /team/pools                  Create memory pool
  GET    /team/pools/:id              Get pool details
```

#### 6.2.2 Request/Response Examples

**Create Memory**
```http
POST /api/v1/memories
Content-Type: application/json

{
  "agentId": "kilo-code",
  "agentType": "kilo-code",
  "userId": "user-123",
  "sessionId": "session-456",
  "project": "my-app",
  "workspace": "/path/to/project",
  "category": "discovery",
  "summary": "Discovered auth pattern in src/auth.ts",
  "detail": "The authentication module uses JWT with refresh tokens...",
  "files": ["src/auth.ts", "src/auth/middleware.ts"],
  "language": ["typescript"],
  "tags": ["auth", "jwt", "middleware"],
  "importance": "high"
}
```

**Response:**
```json
{
  "id": "mem-abc123",
  "agentId": "kilo-code",
  "category": "discovery",
  "confidence": 0.92,
  "importance": "high",
  "createdAt": "2026-04-03T10:30:00Z",
  "status": "active",
  "relatedMemories": ["mem-def456", "mem-ghi789"]
}
```

**Semantic Search**
```http
POST /api/v1/memories/search
Content-Type: application/json

{
  "query": "how does authentication work?",
  "limit": 5,
  "filters": {
    "project": "my-app",
    "category": ["discovery", "decision"],
    "importance": ["high", "critical"]
  }
}
```

### 6.3 MCP Server

#### 6.3.1 Tools

```
nautalis MCP Server provides:

Tools:
  store_memory
    Store a memory record
    Parameters: agentId, content, category, metadata

  query_memories
    Search and retrieve memories
    Parameters: query, filters, limit

  get_context
    Get synthesized context for an agent
    Parameters: agentId, project, scope

  list_agents
    List registered agents
    Parameters: none

  get_agent_status
    Get status of a specific agent
    Parameters: agentId
```

#### 6.3.2 Resources

```
Resources:
  memory://{id}          — Individual memory record
  agent://{id}           — Agent details
  agent://{id}/context   — Current context for agent
  project://{name}       — Project memory summary
  system://status        — System status
```

### 6.4 TUI (ink)

#### 6.4.1 Screens

```
┌─────────────────────────────────────────────────────┐
│  🐙 Nautalis — AI Agent Memory Platform             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Memory: 12,847  │  Agents: 4  │  Connectors: 3/4  │
│                                                     │
│  ┌─ Recent Activity ─────────────────────────────┐  │
│  │ [10:30] kilo-code  →  discovery  auth pattern │  │
│  │ [10:28] claude     →  decision  refactor plan │  │
│  │ [10:25] cursor     →  edit      src/utils.ts  │  │
│  │ [10:22] kilo-code  →  error     type mismatch │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Connector Status ──────────────────────────────┐ │
│  │ ✓ kilo-code    │  ✓ claude-code  │ ✗ cursor    │ │
│  │   847 events   │    523 events   │  reconnecting│ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [Query] [Agents] [Connectors] [Telemetry] [Config] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 7. Observability Requirements

### 7.1 Tracing

| Requirement | Specification |
|-------------|--------------|
| Trace propagation | W3C Trace Context (traceparent header) |
| Span naming | `<component>.<operation>` (e.g., `memory.store`) |
| Span attributes | Resource attributes: `service.name=nautalis`, `service.version` |
| Sampling | Head-based, configurable rate (default: 100% for local) |
| Export | OTLP over HTTP (default: localhost:4318) |

### 7.2 Logging

| Requirement | Specification |
|-------------|--------------|
| Format | Structured JSON |
| Levels | DEBUG, INFO, WARN, ERROR, FATAL |
| Context | Every log includes: `traceId`, `spanId`, `memoryId` (if applicable) |
| Redaction | PII automatically redacted from log output |
| Export | Console (default), file, OTLP |

### 7.3 Metrics

| Requirement | Specification |
|-------------|--------------|
| Protocol | OpenTelemetry Metrics |
| Export | OTLP over HTTP (default: localhost:4318) |
| Interval | 15 seconds (configurable) |
| Histogram buckets | [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] ms |

### 7.4 Benchmarking Pipeline

| Requirement | Specification |
|-------------|--------------|
| Benchmark types | Ingestion latency, query latency, embedding throughput |
| Execution | On-demand via CLI, scheduled via cron |
| Metrics | p50, p95, p99 latency; throughput (ops/sec) |
| Storage | Results stored as memories with `category: benchmark` |
| Alerting | Configurable thresholds with warnings |

---

## 8. Deployment Scenarios

### 8.1 Personal (SQLite + Ollama)

**Target**: Solo developers  
**Cost**: $0/month  
**Components**:

| Component | Technology | Location |
|-----------|-----------|----------|
| Runtime | Bun | Local |
| Storage | SQLite | Local file (`~/.nautalis/nautalis.db`) |
| Embeddings | Ollama | Local (`localhost:11434`) |
| Observability | OTLP → File | Local (`~/.nautalis/telemetry/`) |
| API | Hono | `localhost:3456` |

**Setup**:
```bash
bun install
ollama pull nomic-embed-text
bun run start
```

**Resource Requirements**:
- CPU: 2 cores minimum
- RAM: 4GB minimum (8GB recommended for Ollama)
- Disk: 1GB + memory storage (estimate: 1KB per memory)

### 8.2 Team (PostgreSQL + Ollama/OpenAI)

**Target**: Small to medium teams (5-50 developers)  
**Cost**: $0-$50/month (depending on embedding provider)  
**Components**:

| Component | Technology | Location |
|-----------|-----------|----------|
| Runtime | Bun | Local or server |
| Storage | PostgreSQL + pgvector | Shared server or managed |
| Embeddings | Ollama or OpenAI | Local or cloud |
| Observability | OTLP → Collector → Backend | Shared |
| API | Hono | Shared server |

**Setup**:
```bash
bun install
bun run start --config config/team.yaml
```

**Configuration**:
```yaml
# config/team.yaml
storage:
  backend: postgresql
  url: postgresql://user:pass@db-server:5432/nautalis

embeddings:
  provider: ollama
  model: nomic-embed-text
  baseUrl: http://embedding-server:11434

team:
  enabled: true
  pools:
    - name: engineering
      members: [user1, user2, user3]
    - name: design
      members: [user4, user5]
```

### 8.3 Enterprise (Supabase + Cloud Embeddings)

**Target**: Large organizations (50+ developers)  
**Cost**: Variable (managed infrastructure)  
**Components**:

| Component | Technology | Location |
|-----------|-----------|----------|
| Runtime | Bun | Container (Docker/Kubernetes) |
| Storage | Supabase (PostgreSQL) | Managed cloud |
| Embeddings | OpenAI / Cloud provider | Cloud API |
| Observability | OTLP → Jaeger/Grafana | Managed |
| API | Hono | Load-balanced |

**Setup**:
```bash
docker-compose -f docker/enterprise.yml up -d
```

**Configuration**:
```yaml
# config/enterprise.yaml
storage:
  backend: supabase
  url: ${SUPABASE_DATABASE_URL}
  poolSize: 20

embeddings:
  provider: openai
  model: text-embedding-3-small
  apiKey: ${OPENAI_API_KEY}

observability:
  exporter: otlp
  endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT}
  sampling: 0.1

team:
  enabled: true
  rbac: true
  audit: true
  pools:
    - name: all-hands
      access: read
    - name: engineering
      access: read-write
    - name: leadership
      access: admin
```

---

## 9. Configuration

### 9.1 Configuration File

```yaml
# nautalis.yaml — Full configuration reference

# Server
server:
  host: localhost
  port: 3456
  cors:
    enabled: false
    origins: []

# Storage
storage:
  backend: sqlite  # sqlite | postgresql | supabase
  sqlite:
    path: ~/.nautalis/nautalis.db
  postgresql:
    url: postgresql://localhost:5432/nautalis
    poolSize: 5
    ssl: false

# Embeddings
embeddings:
  provider: ollama  # ollama | openai | custom
  model: nomic-embed-text
  batchSize: 32
  cache:
    enabled: true
    maxSize: 10000
  ollama:
    baseUrl: http://localhost:11434
  openai:
    apiKey: ${OPENAI_API_KEY}
    model: text-embedding-3-small

# Memory
memory:
  maxContentSize: 100000  # bytes
  defaultImportance: medium
  defaultSensitivity: public
  expiration:
    enabled: false
    defaultDays: 365
  pii:
    enabled: true
    redact: true
    encrypt: false

# Connectors
connectors:
  autoRegister: true
  healthCheckInterval: 30  # seconds
  enabled:
    - kilo-code
    - claude-code
  disabled: []

# Telemetry
telemetry:
  enabled: true
  serviceName: nautalis
  exporter: otlp  # console | file | otlp
  otlp:
    endpoint: http://localhost:4318
  sampling: 1.0  # 0.0–1.0
  metrics:
    interval: 15  # seconds
  logging:
    level: info  # debug | info | warn | error
    format: json

# Team
team:
  enabled: false
  rbac: false
  audit: false
  pools: []

# Orchestration
orchestration:
  contextWindow:
    defaultSize: 10
    maxSize: 50
  ranking:
    relevanceWeight: 0.4
    recencyWeight: 0.3
    importanceWeight: 0.3
  synthesis:
    enabled: true
    deduplicate: true
    summarize: false
```

### 9.2 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NAUTALIS_CONFIG` | Path to config file | `~/.nautalis/config.yaml` |
| `NAUTALIS_PORT` | Server port | `3456` |
| `NAUTALIS_HOST` | Server host | `localhost` |
| `NAUTALIS_STORAGE_BACKEND` | Storage backend | `sqlite` |
| `NAUTALIS_DATABASE_URL` | Database connection string | `sqlite://./nautalis.db` |
| `NAUTALIS_EMBEDDING_PROVIDER` | Embedding provider | `ollama` |
| `NAUTALIS_OLLAMA_BASE_URL` | Ollama base URL | `http://localhost:11434` |
| `NAUTALIS_OPENAI_API_KEY` | OpenAI API key | *(none)* |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP exporter endpoint | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | Service name for traces | `nautalis` |
| `OTEL_LOG_LEVEL` | Log level | `info` |

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|------|-----------|
| **Agent** | An AI coding tool or autonomous system |
| **Connector** | Integration module that captures events from an agent |
| **Context** | Synthesized information relevant to an agent's current work |
| **Embedding** | Vector representation of text for semantic search |
| **Enrichment** | Process of adding metadata, embeddings, and classifications to a memory |
| **Memory** | A stored unit of agent activity with rich metadata |
| **Memory Pool** | A shared collection of memories for a team |
| **Orchestration** | Intelligent coordination of agents through shared memory |
| **PII** | Personally Identifiable Information |
| **RAG** | Retrieval-Augmented Generation |
| **Synthesis** | Combining multiple memories into coherent context |

### 10.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-03 | Initial specification |

### 10.3 Open Questions

1. Should memories support binary attachments (screenshots, diagrams)?
2. What is the strategy for memory deduplication across agents?
3. How should cross-team memory sharing be governed?
4. Should the system support real-time memory streaming (WebSocket/SSE)?
5. What is the retention policy for expired memories?
