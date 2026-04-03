# Architecture

Deep dive into Nautalis system design, components, and data flow.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Nautalis Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Interfaces: CLI (commander) │ REST (Hono) │ MCP │ TUI│   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │              Orchestration Layer                      │   │
│  │     Context Synthesis │ Agent Coordination │ Rules    │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │              Memory Engine (LlamaIndex.TS)            │   │
│  │     Enrichment │ Embeddings │ Classification │ RAG    │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │              Connector Layer (Registry)               │   │
│  │     Claude Code │ Kilo Code │ Cursor │ Custom Agents  │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐   │
│  │              Storage Layer                           │   │
│  │     SQLite (local) │ PostgreSQL (team) │ Supabase     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         OpenTelemetry Observability (Cross-cutting)  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Connector Layer

The connector layer bridges external AI tools with Nautalis internals.

**Responsibilities:**
- Read events from agent-native formats (JSON logs, hook payloads, file watches)
- Translate to unified `AgentEvent` schema
- Stream events into the memory engine
- Optionally receive injected context back

**Key files:**
- `src/connectors/base.ts` — Base `Connector` interface and abstract class
- `src/connectors/registry.ts` — Singleton registry with auto-registration
- `src/connectors/claude-code/` — Claude Code integration
- `src/connectors/kilo-code/` — Kilo Code integration

**Connector Interface:**

```typescript
export interface Connector {
  id: string;
  name: string;
  version: string;

  initialize(config: ConnectorConfig): Promise<void>;
  captureEvent(event: AgentEvent): Promise<MemoryRecord>;
  streamEvents(): AsyncIterable<AgentEvent>;
  healthCheck(): Promise<HealthStatus>;
  shutdown(): Promise<void>;
}
```

**Auto-registration:** Connectors register themselves on import via side-effect in their `index.ts`:

```typescript
import { ConnectorRegistry } from '../registry.js';
import { ClaudeCodeConnector } from './connector.js';

const connector = new ClaudeCodeConnector();
ConnectorRegistry.getInstance().register(connector);
```

### Memory Engine

The core intelligence layer that transforms raw events into structured memories.

**Responsibilities:**
- **Enrichment** — Add agent identity, project context, timestamps, classification
- **Classification** — Categorize memories (episodic, semantic, procedural, decision, lesson, preference)
- **Embedding generation** — Produce vector representations via LlamaIndex.TS
- **Importance scoring** — Determine memory retention priority
- **Relationship extraction** — Link related memories into a knowledge graph

**Key files:**
- `src/memory/engine.ts` — Core memory engine orchestration
- `src/memory/enricher.ts` — Metadata enrichment pipeline
- `src/memory/classifier.ts` — Automatic classification logic
- `src/memory/embeddings.ts` — Embedding service (Ollama, OpenAI, Cohere)
- `src/memory/retriever.ts` — RAG retrieval via LlamaIndex.TS
- `src/memory/types.ts` — Memory type definitions

**RAG Pipeline (LlamaIndex.TS):**

```typescript
import { VectorStoreIndex, serviceContextFromDefaults } from 'llamaindex';

const embedModel = new OllamaEmbedding({
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434',
});

const serviceContext = serviceContextFromDefaults({ embedModel });
const index = await VectorStoreIndex.fromDocuments(memoryDocuments, { serviceContext });
const queryEngine = index.asQueryEngine();
const response = await queryEngine.query({ query: '...', similarityTopK: 5 });
```

### Storage Layer

Pluggable storage backends supporting different deployment scales.

**Responsibilities:**
- Persist memories with full metadata
- Store and retrieve vector embeddings
- Support concurrent access (PostgreSQL/Supabase)
- Run schema migrations

**Key files:**
- `src/store/interface.ts` — Storage interface (IStorage)
- `src/store/sqlite.ts` — SQLite implementation (better-sqlite3)
- `src/store/postgresql.ts` — PostgreSQL implementation
- `src/store/migrations/` — Database migration files

**Storage Interface:**

```typescript
export interface IStorage {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  storeMemory(memory: MemoryRecord): Promise<void>;
  getMemory(id: string): Promise<MemoryRecord | null>;
  searchMemories(query: SearchQuery): Promise<MemoryRecord[]>;
  vectorSearch(embedding: number[], topK: number): Promise<MemoryRecord[]>;
  deleteMemory(id: string): Promise<void>;
  migrate(): Promise<void>;
}
```

### Telemetry Layer

OpenTelemetry instrumentation across all operations.

**Responsibilities:**
- **Tracing** — Distributed traces following events through the pipeline
- **Logging** — Structured JSON logs with correlation IDs
- **Metrics** — Counters, histograms, gauges for system health
- **Benchmarking** — Agent performance tracking over time

**Key files:**
- `src/telemetry/tracer.ts` — Trace setup and utilities
- `src/telemetry/logger.ts` — Structured logging
- `src/telemetry/metrics.ts` — Metrics collection
- `src/telemetry/benchmarks/` — Performance benchmarking

**Tracing example:**

```typescript
const tracer = trace.getTracer('nautalis');

export class MemoryEngine {
  async store(memory: MemoryRecord): Promise<void> {
    return tracer.startActiveSpan('memory.store', async (span) => {
      span.setAttribute('memory.id', memory.id);
      span.setAttribute('agent.id', memory.agentId);
      try {
        // Store logic
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### Orchestration Layer

The intelligence layer that coordinates agents and synthesizes context.

**Responsibilities:**
- **Context synthesis** — Combine relevant memories into coherent context packages
- **Agent coordination** — Detect conflicts, manage concurrent agent activity
- **Rules engine** — Enforce organizational policies and memory lifecycle rules
- **Context injection** — Feed relevant memories into new agent sessions

**Key files:**
- `src/orchestration/synthesizer.ts` — Context synthesis
- `src/orchestration/coordinator.ts` — Agent coordination
- `src/orchestration/rules.ts` — Orchestration rules
- `src/orchestration/context.ts` — Context injection

## Data Flow

### Event Ingestion Pipeline

```
Agent Event ──→ Connector ──→ Memory Engine ──→ Storage
   │               │              │               │
   │               │              │               │
   ▼               ▼              ▼               ▼
 Raw JSON    Normalized     Enriched        Persisted
 payload     AgentEvent     MemoryRecord    with vectors
```

1. **Capture** — Connector reads event from agent (hook, poll, or watch)
2. **Normalize** — Event translated to unified `AgentEvent` schema
3. **Enrich** — Memory engine adds metadata, classification, importance
4. **Embed** — LlamaIndex.TS generates vector embedding
5. **Store** — Memory persisted to storage backend with embedding
6. **Trace** — OpenTelemetry span records the full pipeline

### Context Retrieval Pipeline

```
Agent Request ──→ Context Service ──→ RAG Engine ──→ Storage
     │                  │                 │             │
     │                  │                 │             │
     ▼                  ▼                 ▼             ▼
  Session info     Relevance        Vector search   Memories
  + query          scoring          + metadata      + context
```

1. **Request** — Agent or CLI requests context for a session
2. **Query** — Context service builds search query from session info
3. **Retrieve** — RAG engine performs vector + metadata search
4. **Synthesize** — Relevant memories combined into context package
5. **Inject** — Context returned to requesting agent

## Database Schema

### Core Tables

**memories**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Unique memory identifier |
| agent_id | TEXT | Source agent identifier |
| session_id | TEXT | Session this memory belongs to |
| type | TEXT | Memory type (episodic, semantic, etc.) |
| content | TEXT | Memory content |
| classification | TEXT | Auto-assigned category |
| importance | REAL | Importance score (0.0-1.0) |
| sensitivity | TEXT | Sensitivity level (public, internal, private, secret) |
| embedding | BLOB | Vector embedding |
| metadata | JSON | Rich metadata object |
| relationships | JSON | Related memory IDs and relationship types |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| expires_at | TIMESTAMP | Optional TTL expiration |

**events**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Unique event identifier |
| agent_id | TEXT | Source agent |
| type | TEXT | Event type (tool_call, file_edit, etc.) |
| payload | JSON | Event-specific data |
| timestamp | TIMESTAMP | Event time |
| memory_id | TEXT | Associated memory (nullable) |

**sessions**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Session identifier |
| agent_id | TEXT | Agent that owns the session |
| project | TEXT | Project context |
| started_at | TIMESTAMP | Session start |
| ended_at | TIMESTAMP | Session end (nullable) |
| context_snapshot | JSON | Injected context for the session |

**connectors**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Connector identifier |
| name | TEXT | Display name |
| version | TEXT | Connector version |
| status | TEXT | active, inactive, error |
| config | JSON | Connector-specific configuration |
| last_heartbeat | TIMESTAMP | Last health check |

## OpenTelemetry Signal Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Traces     │────→│  Collector  │────→│  Backend    │
│  (spans)    │     │  (optional) │     │  (Jaeger,   │
└─────────────┘     └─────────────┘     │   Tempo)    │
                                         └─────────────┘
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Logs       │────→│  Processor  │────→│  Storage    │
│  (structured│     │  (filter,   │     │  (Loki,     │
│   JSON)     │     │   enrich)   │     │   file)     │
└─────────────┘     └─────────────┘     └─────────────┘
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Metrics    │────→│  Aggregator │────→│  Dashboard  │
│  (counters, │     │  (window,   │     │  (Grafana,  │
│   histogram)│     │   reduce)   │     │   console)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Key metrics:**
- `nautalis.memory.operations` — Counter of memory operations (store, retrieve, delete)
- `nautalis.query.latency_ms` — Histogram of query response times
- `nautalis.connector.events` — Counter of events per connector
- `nautalis.embedding.latency_ms` — Histogram of embedding generation times
- `nautalis.storage.size_bytes` — Gauge of storage utilization

## Deployment Architectures

### Personal (Default)

```
┌──────────────┐
│  AI Agent    │
│  (any)       │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Nautalis    │────→│  SQLite      │
│  (local)     │     │  (file)      │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│  Ollama      │
│  (local)     │
└──────────────┘
```

- Single user, single machine
- SQLite file storage
- Ollama for local embeddings
- Zero configuration required

### Team

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Agent A  │  │ Agent B  │  │ Agent C  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  Nautalis       │
          │  (shared server)│
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   ┌──────────────┐  ┌──────────────┐
   │ PostgreSQL   │  │  Ollama      │
   │ (multi-user) │  │  or OpenAI   │
   └──────────────┘  └──────────────┘
```

- Multiple users, shared memory
- PostgreSQL for concurrent access
- Shared or cloud embedding provider
- Activity feeds and conflict detection

### Enterprise

```
┌──────────────────────────────────────────────┐
│              Organization                     │
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ Team A │ │ Team B │ │ Team C │           │
│  └───┬────┘ └───┬────┘ └───┬────┘           │
│      │          │          │                 │
│      └──────────┼──────────┘                 │
│                 │                            │
│      ┌──────────┴──────────┐                │
│      │  Nautalis Cluster   │                │
│      │  (load balanced)    │                │
│      └──────────┬──────────┘                │
│                 │                            │
│      ┌──────────┴──────────┐                │
│      ▼                     ▼                │
│  ┌──────────┐        ┌──────────┐           │
│  │ Supabase │        │ OpenTelemetry        │
│  │ (scale)  │        │ Collector            │
│  └──────────┘        └──────────┘           │
└──────────────────────────────────────────────┘
```

- Multi-team, multi-project isolation
- Supabase for horizontal scale
- Full observability pipeline
- Policy enforcement and audit trails
