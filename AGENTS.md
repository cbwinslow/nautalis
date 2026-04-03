# Nautalis — AI Agent Instructions

This document provides instructions for AI coding agents (Kilo, Claude Code, Cursor, Windsurf, etc.) working on the Nautalis project. Read this before making any changes.

## Project Overview

Nautalis is a **Universal AI Agent Memory & Orchestration Platform**. It provides shared, cross-agent memory infrastructure for AI coding tools, enabling any agent to understand what any other agent has done, learned, or decided.

**Core mission**: No AI agent should ever start from zero.

### Architecture

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

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | Bun | Fast, native TypeScript execution |
| **Language** | TypeScript (strict mode) | Type safety, developer experience |
| **RAG / Embeddings** | LlamaIndex.TS | Semantic search, context retrieval, document processing |
| **Observability** | OpenTelemetry | Distributed tracing, structured logging, metrics |
| **CLI** | commander.js | Command-line interface |
| **TUI** | ink (React) | Terminal user interface |
| **REST API** | Hono | Lightweight HTTP server |
| **MCP** | Model Context Protocol | Standard agent protocol |
| **Storage (local)** | better-sqlite3 | Embedded SQLite for zero-config operation |
| **Storage (team)** | PostgreSQL | Multi-user, concurrent access |
| **Embeddings (local)** | Ollama | Zero-cost local embedding generation |
| **Testing** | Vitest | Unit and integration tests |
| **Linting** | ESLint + Prettier | Code quality and formatting |

## Key Directories

```
nautalis/
├── src/
│   ├── connectors/          # AI tool connector implementations
│   │   ├── registry.ts      # Connector registry (auto-registration)
│   │   ├── base.ts          # Base connector interface and abstract class
│   │   ├── claude-code/     # Claude Code connector
│   │   ├── kilo-code/       # Kilo Code connector
│   │   ├── cursor/          # Cursor connector
│   │   └── custom/          # Custom agent connector template
│   ├── memory/              # Memory engine
│   │   ├── engine.ts        # Core memory engine
│   │   ├── enricher.ts      # Memory enrichment pipeline
│   │   ├── classifier.ts    # Automatic classification
│   │   ├── embeddings.ts    # Embedding generation (LlamaIndex.TS)
│   │   ├── retriever.ts     # RAG retrieval (LlamaIndex.TS)
│   │   └── types.ts         # Memory type definitions
│   ├── store/               # Storage backends
│   │   ├── interface.ts     # Storage interface
│   │   ├── sqlite.ts        # SQLite implementation
│   │   ├── postgresql.ts    # PostgreSQL implementation
│   │   └── migrations/      # Database migrations
│   ├── telemetry/           # OpenTelemetry instrumentation
│   │   ├── tracer.ts        # Trace setup and utilities
│   │   ├── logger.ts        # Structured logging
│   │   ├── metrics.ts       # Metrics collection
│   │   └── benchmarks/      # Performance benchmarking
│   └── orchestration/       # Intelligence layer
│       ├── synthesizer.ts   # Context synthesis
│       ├── coordinator.ts   # Agent coordination
│       ├── rules.ts         # Orchestration rules
│       └── context.ts       # Context injection
├── config/                  # Configuration files and schemas
├── migrations/              # Database migration files
├── test/                    # Test suites
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── fixtures/            # Test fixtures and mocks
├── docker/                  # Docker configurations
├── hooks/                   # Git hooks (pre-commit, pre-push)
└── docs/                    # Additional documentation
```

## Coding Standards

### TypeScript

- **Strict mode enabled** — No `any` types, no implicit any, strict null checks
- **Interfaces over types** — Use `interface` for object shapes (extends capability)
- **Explicit return types** — All functions must declare return types
- **No default exports** — Use named exports for better tree-shaking and refactoring
- **Const over let** — Prefer `const`, use `let` only when reassignment is necessary

```typescript
// Good
export interface MemoryRecord {
  id: string;
  agentId: string;
  content: string;
  metadata: MemoryMetadata;
  createdAt: Date;
}

export function createMemory(params: CreateMemoryParams): MemoryRecord {
  // implementation
}

// Bad
export default function createMemory(params: any): any {
  // implementation
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `memory-engine.ts` |
| Interfaces | PascalCase, prefixed with `I` only if ambiguous | `MemoryRecord`, `IStorage` |
| Classes | PascalCase | `MemoryEngine`, `SQLiteStore` |
| Functions | camelCase | `createMemory`, `enrichContent` |
| Constants | UPPER_SNAKE_CASE | `MAX_MEMORY_SIZE`, `DEFAULT_EMBEDDING_MODEL` |
| Enums | PascalCase (type), UPPER_SNAKE_CASE (values) | `MemoryStatus.ACTIVE` |
| Variables | camelCase | `memoryCount`, `embeddingModel` |
| Test files | `*.test.ts` or `*.spec.ts` | `memory-engine.test.ts` |

### Code Organization

- **One class/interface per file** — Keep files focused and discoverable
- **Co-locate tests** — Tests live in `test/` mirroring `src/` structure
- **Barrel exports** — Use `index.ts` for module public API
- **Dependency injection** — Pass dependencies via constructor, never import singletons

### Error Handling

```typescript
// Use custom error classes
export class MemoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

// Use Result pattern for recoverable errors
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

## Important Constraints

### Zero-Cost Requirement

- **All dependencies must be free and open-source**
- **No paid API dependencies** for core functionality
- **Ollama** is the default embedding provider (local, free)
- **SQLite** is the default storage (local, free)
- Cloud providers (OpenAI, PostgreSQL) are optional alternatives

### Offline-First

- Core functionality must work without internet
- Embeddings generated locally via Ollama
- Storage via local SQLite
- Graceful degradation when cloud services unavailable

### Rich Metadata Mandatory

- **Every memory must have full metadata** — no partial records
- Agent identity, context, classification, content, relationships, lifecycle
- Validation at ingestion time
- Schema enforcement at storage time

### Performance Targets

- Memory ingestion: < 100ms (excluding embedding generation)
- Context retrieval: < 500ms for 95th percentile
- Semantic search: < 1s for 100k memories
- Storage: Handle 100k+ memories without degradation

## How Connectors Work

### Registry Pattern

Connectors use an auto-registration pattern:

```typescript
// src/connectors/registry.ts
export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, Connector> = new Map();

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }
}

// Auto-registration via side effect
// src/connectors/kilo-code/index.ts
import { ConnectorRegistry } from '../registry.js';
import { KiloCodeConnector } from './connector.js';

const connector = new KiloCodeConnector();
ConnectorRegistry.getInstance().register(connector);
```

### Connector Interface

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

### Adding a New Connector

1. Create directory: `src/connectors/<agent-name>/`
2. Implement `Connector` interface
3. Create `index.ts` with auto-registration
4. Add tests in `test/integration/connectors/<agent-name>/`
5. Update documentation

## How LlamaIndex.TS Is Used

### RAG Pipeline

LlamaIndex.TS powers the memory retrieval pipeline:

```typescript
import {
  VectorStoreIndex,
  StorageContext,
  serviceContextFromDefaults,
} from 'llamaindex';

// Create embedding service (Ollama for local, zero-cost)
const embedModel = new OllamaEmbedding({
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434',
});

// Create service context
const serviceContext = serviceContextFromDefaults({
  embedModel,
});

// Build index from memories
const index = await VectorStoreIndex.fromDocuments(
  memoryDocuments,
  { serviceContext }
);

// Query with RAG
const queryEngine = index.asQueryEngine();
const response = await queryEngine.query({
  query: 'What did I learn about the auth module?',
  similarityTopK: 5,
});
```

### Embedding Generation

```typescript
// src/memory/embeddings.ts
export class EmbeddingService {
  private model: EmbeddingModel;

  constructor(provider: EmbeddingProvider) {
    this.model = provider.createEmbeddingModel();
  }

  async generate(text: string): Promise<number[]> {
    return this.model.getTextEmbedding(text);
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.generate(t)));
  }
}
```

### Document Processing

```typescript
import { Document, NodeParser, SimpleNodeParser } from 'llamaindex';

// Parse memory content into searchable nodes
const nodeParser = new SimpleNodeNodeParser({
  chunkSize: 512,
  chunkOverlap: 50,
});

const document = new Document({ text: memoryContent });
const nodes = nodeParser.getNodesFromDocuments([document]);
```

## How OpenTelemetry Is Used

### Tracing

```typescript
import { trace } from '@opentelemetry/api';

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
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### Metrics

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('nautalis');

// Counter for memory operations
const memoryCounter = meter.createCounter('nautalis.memory.operations', {
  description: 'Total memory operations',
});

// Histogram for query latency
const queryLatency = meter.createHistogram('nautalis.query.latency_ms', {
  description: 'Query latency in milliseconds',
  unit: 'ms',
});

// Record metrics
memoryCounter.add(1, { operation: 'store', agent: 'kilo-code' });
queryLatency.record(latencyMs, { query_type: 'semantic' });
```

### Structured Logging

```typescript
import { logger } from '../telemetry/logger.js';

logger.info({
  message: 'Memory stored successfully',
  memoryId: memory.id,
  agentId: memory.agentId,
  embeddingLatency: latencyMs,
  storageBackend: 'sqlite',
});
```

## Testing Requirements

### Test Structure

```
test/
├── unit/                    # Unit tests (fast, isolated)
│   ├── memory/
│   ├── connectors/
│   ├── store/
│   └── telemetry/
├── integration/             # Integration tests (real dependencies)
│   ├── connectors/
│   ├── store/
│   └── memory/
└── fixtures/                # Shared test data
```

### Running Tests

```bash
# All tests
bun test

# Unit tests only
bun test test/unit/

# Integration tests
bun test test/integration/

# With coverage
bun test --coverage

# Watch mode
bun test --watch
```

### Test Conventions

- Use `describe`/`it` blocks with descriptive names
- Arrange-Act-Assert pattern
- Mock external services (Ollama, databases) in unit tests
- Use real dependencies in integration tests
- Test both success and error paths
- Include edge cases (empty inputs, large payloads, concurrent access)

```typescript
describe('MemoryEngine', () => {
  describe('store', () => {
    it('should store a memory with full metadata', async () => {
      // Arrange
      const engine = createTestEngine();
      const memory = createTestMemory();

      // Act
      const result = await engine.store(memory);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.metadata).toEqual(expect.objectContaining({
        agentId: memory.agentId,
        createdAt: expect.any(Date),
      }));
    });

    it('should reject memories without required metadata', async () => {
      // Arrange
      const engine = createTestEngine();
      const incompleteMemory = { content: 'test' };

      // Act & Assert
      await expect(engine.store(incompleteMemory)).rejects.toThrow(
        MemoryValidationError
      );
    });
  });
});
```

## Development Workflow

### Setup

```bash
# Clone and install
git clone <repo>
cd nautalis
bun install

# Start Ollama (for local embeddings)
ollama pull nomic-embed-text
ollama serve

# Run with defaults
bun run start

# Run with specific config
bun run start --config config/development.yaml
```

### Common Commands

```bash
bun run start          # Start the server
bun run dev            # Start with hot reload
bun run test           # Run all tests
bun run lint           # Run ESLint
bun run format         # Run Prettier
bun run typecheck      # Run TypeScript type checking
bun run build          # Build for production
bun run migrate        # Run database migrations
bun run telemetry      # Start observability dashboard
```

## When You're Unsure

1. **Check existing code** — Look at similar implementations in the codebase
2. **Follow interfaces** — Implement existing interfaces rather than creating new patterns
3. **Add telemetry** — Instrument new code with OpenTelemetry from the start
4. **Write tests first** — Define expected behavior before implementation
5. **Ask for clarification** — If requirements are ambiguous, ask before implementing
