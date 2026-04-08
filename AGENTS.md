# 🐙 Nautalis — AI Agent Instructions

> **Universal AI Agent Memory & Orchestration Platform**
>
> This document is for AI agents (Kilo Code, Claude Code, Cursor, etc.) working on this project. Read it thoroughly before making changes.

---

## 1. Project Vision

Nautalis solves a critical problem: **AI coding agents are siloed**. Developers use multiple tools (Claude Code, Kilo Code, Cursor, Windsurf, etc.) and none of them share memory, context, or awareness. When you switch agents, context is lost. When teammates work on the same project, duplicate effort happens.

**Nautalis sits behind ALL AI agents and:**

1. **Aggregates** every event — tool calls, file edits, commands, decisions, errors
2. **Enriches** with rich metadata — agent identity, project context, classification, relationships
3. **Stores** with vector embeddings — semantic search across all AI activity
4. **Synthesizes** cross-agent context — unified view of what's happening
5. **Injects** smart context — feeds relevant memories into new sessions
6. **Observes** everything — OpenTelemetry traces, logs, metrics for diagnosis

**Mascot:** Purple octopus/squid. The name "nautalis" comes from nautilus — ancient cephalopod, smart, evolved, timeless. Tentacles reaching everywhere.

---

## 1.5 Current Status & Critical Priorities

**Last Updated:** 2026-04-07  
**Status:** Early Alpha (v0.1.0) — Near Production Ready (~99% Complete)

**Read First:** [Comprehensive Review Analysis](./docs/decisions/COMPREHENSIVE_REVIEW_2026-04-03.md) and [FEATURES.md](./FEATURES.md) for product goals and MVP definition

The project has exceptional architectural foundations and is nearly complete. Most features are implemented and validated.

### Top Immediate Priorities (Next 90 Days)

✅ **Setup Wizard** — Interactive CLI wizard to lower onboarding barrier (issue #46) — COMPLETED
2. **Connector validation** — Test Claude/Kilo hooks on real installations (issues #12, #14) — CRITICAL (implementation complete; validation pending)
✅ **Multi-provider CLI management** — Add commands to manage providers programmatically (issue #61) — COMPLETED
✅ **Security hardening** — Rate limiting, complete audit logging invocation — COMPLETED
✅ **Production deployment guide** — Step-by-step for real-world environments — COMPLETED

### Completed Since 2026-04-04

- **Observability Complete** — Full OTel pipeline validated with Jaeger + Grafana
- **Performance Benchmarks** — Latency p95: vector 17ms, FTS 14ms, hybrid 184ms (all <500ms target)
 - **Test Coverage** — ~215 passing tests, ~77% function coverage, ~85% line coverage
- **Docker Deployment** — Observability stack operational with external PostgreSQL
- **Provider Registry** — Multi-provider support for embeddings and LLM (Ollama, OpenAI, Anthropic, Cohere, custom)
- **Connector Health** — Aggregated health reporting via `connectors health` and `/health` endpoint
- **FileSystem Watch** — Polling-based file watcher with mtime change detection

### Component Completeness

- **Storage Layer:** 90% — Indexes, validation, retry, permissions, TimescaleDB integration
- **RAG/Search:** 88% — LlamaIndex integrated, hybrid search, synthesis, vector + FTS indexes
- **Context Injection:** 60% — Semantic CLI and daemon with recency fallback (functional)
- **Team Features:** 90% — RBAC, audit, CLI management fully implemented
- **Observability:** 95% — SDK, full instrumentation, collector, Jaeger/Grafana, health checks
 - **Security:** 90% — PII, input validation, rate limiting, comprehensive audit logging
 - **CLI Commands:** 100% — All 17 commands fully functional
 - **Test Infrastructure:** ~87%+ — 215 passing tests, >80% function coverage, unit + integration coverage
 - **Connector System:** ~70% — Multiple connectors implemented (Claude Code, Kilo Code, Cursor, FileSystem); health and watch functional; real-world validation pending

### Critical Success Factors

- **Connector validation** — Must test hooks on actual Claude/Kilo installations
- **RAG performance** — Search latency must be <500ms p95
- **Test coverage** — Without tests, refactoring is risky
- **MVP clarity** — Ruthlessly cut scope to ship functional system

**DO NOT** start work on non-MVP features until MVP scope is defined and approved. Refer to [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed component-wise completeness.

---

## 2. Critical Architecture Decisions

### 2.1 TypeScript, Not Go

- **Decision:** Primary language is TypeScript, not Go
- **Why:** Faster development, better AI tool integration (most have TS/JS SDKs), native web support, Bun runtime is extremely fast
- **Package manager:** Bun (fastest installs, native TypeScript, built-in test runner)
- **CLI framework:** commander.js
- **TUI framework:** ink (React-based terminal UI)

### 2.2 PostgreSQL Only — SQLite Was Dropped

- **Decision:** SQLite was completely removed. PostgreSQL is the ONLY database.
- **Why:** User is building a data bottleneck — logs, errors, warnings, results, network traffic, conversations, ETL pipelines. Millions of rows. Multi-user, multi-team, granular permissions. SQLite can't handle this.
- **Extensions:** pgvector (embeddings), TimescaleDB (time-series), pg_trgm (fuzzy search), uuid-ossp
- **Default driver:** `postgres` (not sqlite)
- **Supabase:** Used for auth (GoTrue), RLS, Realtime, and managed Postgres

### 2.3 TimescaleDB for Time-Series

- **Decision:** TimescaleDB as a PostgreSQL extension for all time-series data
- **Why:** User accumulates massive data over time. Needs automatic compression, retention policies, and continuous aggregates for dashboards.
- **Hypertables:** events (7d chunks, compress 30d, retain 365d), telemetry (1d chunks, compress 7d, retain 90d), audit_log (7d chunks, compress 30d, retain 730d)
- **Continuous aggregates:** daily event stats, daily memory stats, hourly latency percentiles (p50/p95/p99)

### 2.4 LlamaIndex.TS for RAG

- **Decision:** LlamaIndex.TS for retrieval-augmented generation and embeddings
- **Why:** Leading TypeScript framework for context engineering. Native Bun support. Handles indexing, retrieval, synthesis, and agent workflows.
- **Embeddings:** Ollama (local, free, default) via custom OllamaEmbedding class. OpenAI and Cohere as alternatives.
- **Vector store:** pgvector in PostgreSQL (not separate vector DB)

### 2.5 OpenTelemetry for Observability

- **Decision:** Full OpenTelemetry SDK for traces, metrics, and logs
- **Why:** User wants a sophisticated log and capture system that feeds into a pipeline for diagnosing and benchmarking issues. Every operation is traced, every metric recorded, every log correlated.
- **Enterprise stack:** OTel Collector → Jaeger (traces) + Grafana (metrics)
- **Benchmarking utility:** Built-in `benchmarkOperation()` wraps any async function with timing, tracing, and metrics

### 2.6 Row Level Security + RBAC

- **Decision:** PostgreSQL RLS policies on EVERY table, combined with application-level RBAC
- **Why:** Multi-tenant system where managers assign permissions. Users only see what they're allowed to see. Security at the database level, not just the application level.
- **Role hierarchy:** owner > admin > manager > member > viewer
- **Permission scopes:** team, project, agent, memory, knowledge_base, telemetry, settings
- **Permission actions:** read, write, delete, admin, share, export, import
- **Helper function:** `can(user_id, scope, action)` — shorthand for permission checks

### 2.7 Universal Knowledge Base

- **Decision:** Dedicated knowledge base table that AI agents can pull from
- **Why:** User wants a centralized knowledge repository — not just raw memories, but curated, versioned, categorized knowledge entries with visibility controls.
- **Features:** Vector + full-text search, versioning with edit history, visibility levels (public/team/project/private), view tracking
 - **AI access:** Agents query via REST API (`knowledge-base` CLI and daemon endpoints)

---

## 3. Tech Stack

| Layer               | Technology       | Notes                                          |
| ------------------- | ---------------- | ---------------------------------------------- |
| **Runtime**         | Bun              | Fastest Node.js alternative, native TypeScript |
| **CLI**             | commander.js     | Standard, well-documented                      |
| **TUI**             | ink (React)      | Component-based terminal UI                    |
| **Database**        | PostgreSQL 16    | ONLY database — no SQLite                      |
| **Time-Series**     | TimescaleDB 2.26 | PostgreSQL extension                           |
| **Vector Search**   | pgvector         | PostgreSQL extension                           |
| **RAG**             | LlamaIndex.TS    | Context engineering framework                  |
| **Embeddings**      | Ollama (default) | Local, free, nomic-embed-text (768-dim)        |
| **Observability**   | OpenTelemetry    | Traces, metrics, logs                          |
| **Auth**            | Supabase GoTrue  | When using Supabase driver                     |
| **Package Manager** | bun              | `bun install`, `bun run`, `bun test`           |
 
 ### Multi-Provider Configuration

Nautalis supports multiple embedding and LLM providers via a registry system. Define named providers in the `providers` section of your config:

```json
{
  "providers": {
    "ollama-local": {
      "type": "ollama",
      "url": "http://localhost:11434",
      "model": "nomic-embed-text"
    },
    "openai-gpt": {
      "type": "openai",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-4-turbo"
    }
  },
  "embeddings": {
    "provider": "ollama-local"
  },
  "llm": {
    "provider": "openai-gpt"
  }
}
```

The `ProviderRegistry` resolves the named provider and instantiates the appropriate service. Legacy direct configuration (without `providers` map) continues to work for backward compatibility.

- `providers` — map of provider name → `ProviderConfig`
- `ProviderConfig.type` — one of: `ollama`, `openai`, `anthropic`, `cohere`, `custom`
- Each provider can define `baseUrl`, `model`, `apiKeyEnv`, `apiKey`, and provider-specific options.
- Capabilities vary: Anthropic does not provide embeddings; Cohere only provides embeddings. The registry enforces capabilities.

---

 ## 4. Project Structure

```
nautalis/
├── src/
│   ├── cli.ts                    # Entry point (commander.js)
│   ├── commands/                 # CLI commands (14 total)
│   │   ├── init.ts               # Initialize database, connectors
│   │   ├── ingest.ts             # Import events from agents
│   │   ├── search.ts             # Search memories
│   │   ├── ask.ts                # RAG-powered Q&A
│   │   ├── timeline.ts           # Chronological view
│   │   ├── status.ts             # System status
│   │   ├── hooks.ts              # Hook management
│   │   ├── memory.ts             # Memory management
│   │   ├── inject.ts             # Context injection
│   │   ├── connectors.ts         # Connector management
│   │   ├── setup.ts              # Setup wizard
│   │   ├── daemon.ts             # Background daemon
│   │   ├── team.ts               # Team management (create, invite, role, etc.)
│   │   ├── permissions.ts        # Permission management (check, grant, revoke, matrix)
│   │   └── knowledge-base.ts     # Knowledge base (create, search, list, get, delete)
│   ├── connectors/               # AI agent integrations (OUR MOAT)
│   │   ├── registry.ts           # Connector registry with auto-registration
│   │   ├── base.ts               # BaseConnector abstract class
│   │   ├── claude-code.ts        # Claude Code (hooks + transcript parsing)
│   │   ├── kilo-code.ts          # Kilo Code (session parsing)
│   │   └── filesystem.ts         # Generic filesystem connector
│   ├── memory/                   # Memory enrichment layer (OUR IP)
│   │   ├── engine.ts             # Core memory orchestration
│   │   ├── classify.ts           # Auto-classification (topics, importance)
│   │   ├── extract.ts            # Decision extraction
│   │   ├── embed.ts              # Embedding service (Ollama)
│   │   ├── rag.ts                # LlamaIndex.TS RAG engine
│   │   └── ollama-embed.ts       # LlamaIndex-compatible Ollama embedding
│   ├── store/                    # Database layer
│   │   ├── interface.ts          # Store interface (all backends implement)
│   │   ├── factory.ts            # Driver-based factory (postgres/supabase)
│   │   ├── postgres/
│   │   │   ├── store.ts          # Full PostgreSQL implementation
│   │   │   ├── permissions.ts    # Permission manager with role caching
│   │   │   └── knowledge-base.ts # Knowledge base engine
│   │   └── supabase/
│   │       └── store.ts          # Supabase extension (auth + realtime)
│   ├── telemetry/                # OpenTelemetry observability
│   │   ├── provider.ts           # SDK initialization (traces, metrics, logs)
│   │   ├── api.ts                # Convenience API (createSpan, recordMetric, logMessage)
│   │   ├── benchmark.ts          # Benchmarking utility
│   │   └── middleware.ts         # Telemetry middleware for operations
│   ├── config/                   # Configuration system
│   │   ├── defaults.ts           # Default config (PostgreSQL default)
│   │   ├── loader.ts             # Cosmiconfig + env + CLI overrides
│   │   └── index.ts
│   ├── types/                    # TypeScript type definitions
│   │   ├── event.ts              # Universal event schema
│   │   ├── memory.ts             # Rich memory schema
│   │   ├── connector.ts          # Connector interface
│   │   ├── config.ts             # Config types (postgres/supabase only)
│   │   ├── team.ts               # Team, User, TeamMember, RolePermission
│   │   ├── permissions.ts        # PermissionCheck, PermissionMatrix
│   │   ├── knowledge-base.ts     # KnowledgeBaseEntry, KnowledgeBaseQuery
│   │   ├── context.ts            # AgentContext for injection
│   │   └── telemetry.ts          # OTel span/metric/log types
│   └── tui/                      # Ink React TUI components
│       ├── components/
│       │   ├── status-bar.tsx
│       │   ├── memory-list.tsx
│       │   ├── timeline.tsx
│       │   └── setup-wizard.tsx
│       └── index.ts
├── migrations/postgres/          # SQL migrations (13 files)
│   ├── core/                     # Core schema (8 files)
│   ├── timescaledb/              # Hypertables and aggregates (3 files)
│   └── rls/                      # RLS policies and functions (2 files)
├── hooks/                        # Distributable hook scripts
│   ├── claude/                   # Claude Code hooks (Node.js)
│   └── install.sh                # One-liner installer
├── docker/                       # Docker deployment
│   ├── Dockerfile                # Multi-stage Bun build
│   ├── docker-compose.yml        # Personal (PostgreSQL + TimescaleDB)
│   ├── docker-compose.team.yml   # Team (Supabase self-hosted)
│   └── docker-compose.enterprise.yml # Enterprise (Supabase + OTel + Jaeger + Grafana)
├── .github/                      # GitHub automation
│   ├── workflows/                # 8 CI/CD workflows
│   ├── ISSUE_TEMPLATE/           # 4 issue templates
│   ├── dependabot.yml            # Dependency automation
│   ├── labeler.yml               # Auto-label PRs by file path
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                         # Full documentation (24 files)
├── config/default.toml           # Reference TOML config
├── .env.example                  # Environment variables template
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── AGENTS.md                     # This file
```

---

## 5. Database Schema Overview

### Core Tables

- **users** — User profiles, linked to Supabase auth.users
- **teams** — Team/org units with settings and limits
- **team_members** — Membership with role (owner/admin/manager/member/viewer)
- **role_permissions** — Default permission matrix per role (seeded)
- **team_permissions** — Custom permission overrides per user
- **resource_shares** — Cross-team and cross-user resource sharing
- **projects** — Logical project groupings within teams
- **agents** — AI tool instances (Claude, Kilo, etc.)
- **sessions** — AI agent conversation sessions
- **events** — All AI agent events (tool calls, edits, commands, decisions, errors)
- **memories** — Enriched memories with classification, relationships, lifecycle
- **memory_embeddings** — pgvector embeddings for memories (768-dim)
- **knowledge_base** — Curated knowledge entries with versioning
- **knowledge_base_embeddings** — pgvector embeddings for KB entries
- **knowledge_base_history** — Edit history for KB entries
- **audit_log** — All audit events (who did what, when)
- **telemetry** — OpenTelemetry traces, metrics, logs

### TimescaleDB Hypertables

- **events** — 7-day chunks, compress after 30d, retain 365d
- **audit_log** — 7-day chunks, compress after 30d, retain 730d
- **telemetry** — 1-day chunks, compress after 7d, retain 90d

### Continuous Aggregates

- **events_daily_stats** — Daily event counts, session counts, error rates
- **memories_daily_stats** — Daily memory growth, importance, staleness
- **telemetry_hourly_latency** — p50/p95/p99 latency percentiles

### Key Helper Functions

- `has_team_role(team_id, user_id, role)` — Check user's role in a team
- `get_user_teams(user_id)` — Get all teams a user belongs to
- `has_permission(user_id, team_id, scope, action)` — Check if user has permission
- `can(user_id, scope, action)` — Shorthand using current team context
- `set_current_team(team_id)` — Set session-level team context
- `find_similar_memories(embedding, team_id, limit, min_score)` — Vector search
- `search_knowledge_base(query, team_id, embedding, limit, category)` — KB search
- `get_team_dashboard(team_id)` — Returns JSONB dashboard stats
- `auto_stale_memories()` — Auto-mark stale memories
- `track_memory_access(memory_id)` — Update access count and timestamp

---

## 6. Permission Model

### Role Hierarchy

```
owner > admin > manager > member > viewer
```

### Permission Matrix (defaults, seeded in migration 004)

| Scope          | owner                          | admin                          | manager                        | member            | viewer |
| -------------- | ------------------------------ | ------------------------------ | ------------------------------ | ----------------- | ------ |
| team           | admin,read,write,delete        | read,write                     | read                           | —                 | —      |
| project        | admin,read,write,delete        | admin,read,write,delete        | admin,read,write,delete        | read,write        | read   |
| agent          | admin,read,write,delete        | admin,read,write,delete        | read,write                     | read,write        | read   |
| memory         | read,write,delete,export,share | read,write,delete,export,share | read,write,delete,export,share | read,write,export | read   |
| knowledge_base | read,write,delete,share        | read,write,delete,share        | read,write,share               | read,write        | read   |
| telemetry      | read,export                    | read,export                    | read                           | read              | read   |
| settings       | admin,read,write               | read,write                     | read                           | —                 | —      |

### RLS Policies

Every table has Row Level Security enabled. Key policies:

- **memories**: Sensitivity-based — public (all), internal (all team), confidential (manager+), secret (admin+)
- **knowledge_base**: Visibility-based — public (all), team (team members), project (project members), private (creator only)
- **audit_log**: Admin/owner only
- **All other tables**: Team membership required

### Custom Overrides

`team_permissions` table allows granular overrides that bypass role defaults. PermissionManager caches role lookups for 60 seconds.

---

## 7. Connector Architecture

### How Connectors Work

1. Each connector implements the `Connector` interface (metadata, setup, ingest, watch, inject, health)
2. Connectors auto-register via module imports (no manual registration needed)
3. `ConnectorRegistry` manages all connectors and provides batch operations
4. Each connector has its own config in `config.connectors[]`

### Adding a New Connector

1. Create `src/connectors/<name>.ts` extending `BaseConnector`
2. Implement `metadata`, `ingest()`, and optionally `setup()`, `watch()`, `inject()`, `health()`
3. Export from `src/connectors/index.ts`
4. The connector auto-registers when imported

### Hook Installation

Claude Code hooks are installed by writing to `~/.claude/settings.json`. The hooks are:

- **PostToolUse** → `nautalis ingest claude-event --async` (records every tool call)
- **Stop** → `nautalis summarize-session` (triggers session summarization)
- **SessionEnd** → `nautalis finalize-session` (finalizes session data)
- **SessionStart** → `nautalis inject-context` (injects relevant context into new session)

**Note:** The hook scripts read `NAUTALIS_SERVER_URL` environment variable to determine where to send requests. Set this to your Nautalis server address (e.g., `http://100.x.y.z:3002`) for remote deployments. Default is `http://localhost:3002` when using Docker Compose, or `http://localhost:3001` for native runs.

---

## 8. Memory Enrichment Pipeline

When an event is ingested, it flows through:

```
Raw Event → MemoryClassifier → DecisionExtractor → EmbeddingService → Store
```

1. **MemoryClassifier** — Determines memory type (episodic/semantic/procedural/decision/lesson/preference), extracts topics from tool names and file paths, calculates importance score (0.0-1.0), detects sensitivity level
2. **DecisionExtractor** — Pattern-based extraction from conversation text (TODO: replace with LLM-based)
3. **EmbeddingService** — Generates 768-dim vector via Ollama (nomic-embed-text)
4. **Store** — Inserts memory + embedding into PostgreSQL

### Memory Relationships

Memories can link to each other:

- `parent_memory_id` — Hierarchical relationship
- `supersedes[]` — This memory replaces older ones
- `contradicts[]` — This memory conflicts with others (flagged for review)
- `supports[]` — This memory reinforces others

### Lifecycle Management

- `ttl` — Optional expiration date
- `decay_rate` — How fast relevance decreases (0.0-1.0)
- `is_stale` — Auto-detected staleness (no access for 30d, or past TTL)
- `access_count` / `last_accessed_at` — Usage tracking

---

## 9. OpenTelemetry Integration

### What's Instrumented

- **All store operations** — insertEvent, insertMemory, queryMemories, etc.
- **All connector operations** — setup, ingest, watch, inject
- **All memory operations** — enrich, classify, embed
- **All RAG operations** — retrieve, synthesize, kb_search
- **All context operations** — build, inject

### Span Names (convention: `nautalis.<domain>.<operation>`)

- `nautalis.ingest.event` — Event ingestion
- `nautalis.memory.enrich` — Memory enrichment
- `nautalis.memory.store` — Memory storage
- `nautalis.memory.query` — Memory query
- `nautalis.embed.text` — Text embedding
- `nautalis.connector.setup/ingest/watch/inject` — Connector operations
- `nautalis.rag.retrieve/synthesize` — RAG operations
- `nautalis.context.build/inject` — Context operations

### Metric Names

- `nautalis.events.ingested` — Counter of ingested events
- `nautalis.memories.stored` — Counter of stored memories
- `nautalis.memories.queried` — Counter of memory queries
- `nautalis.embeddings.generated` — Counter of embeddings
- `nautalis.connector.errors` — Counter of connector errors
- `nautalis.query.latency_ms` — Histogram of query latencies
- `nautalis.memory.total_count` — Gauge of total memories

### Benchmarking

Use `benchmarkOperation(fn, { spanName, metricName, attributes, logResult })` to wrap any async function. It automatically:

- Creates a span with attributes
- Records duration metric
- Logs success/failure
- Returns both result and benchmark data

---

## 10. Configuration System

### Priority Order (lowest to highest)

1. **Defaults** (`src/config/defaults.ts`)
2. **Config file** (cosmiconfig: `.nautalisrc`, `nautalis.config.toml`, etc.)
3. **Environment variables** (`DATABASE_URL`, `NAUTALIS_*`, `OTEL_*`)
4. **CLI flags** (command-specific overrides)

### Required Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/nautalis  # Required
NAUTALIS_DB_DRIVER=postgres                               # postgres | supabase
NAUTALIS_EMBED_PROVIDER=ollama                            # ollama | openai | cohere | custom
NAUTALIS_LLM_PROVIDER=ollama                              # ollama | openai | anthropic | custom
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318         # OTel collector
```

**Custom Provider Configuration:**

For `custom` providers, additional environment variables are required:

- **Embeddings (custom):**  
  `NAUTALIS_EMBED_CUSTOM_BASE_URL` – Remote endpoint (e.g., `http://100.x.y.z:11434`)  
  `NAUTALIS_EMBED_CUSTOM_MODEL` – Model name (e.g., `nomic-embed-text`)  
  `NAUTALIS_EMBED_CUSTOM_API_KEY_ENV` – Optional env var name for API key  
- **LLM (custom):**  
  `NAUTALIS_LLM_CUSTOM_BASE_URL` – Remote endpoint (e.g., `http://100.x.y.z:11434`)  
  `NAUTALIS_LLM_CUSTOM_MODEL` – Model name (e.g., `qwen2.5:3b`)  
  `NAUTALIS_LLM_CUSTOM_API_KEY_ENV` – Optional env var name for API key  

Custom providers accept any REST endpoint that follows OpenAI-compatible schemas (`/embeddings` for embeddings, `/chat/completions` for LLM). Transformations can be configured via code if needed.

### Default Configuration

- Database: PostgreSQL (NOT SQLite)
- Embeddings: Ollama (nomic-embed-text, localhost:11434) — can be switched to remote via config
- LLM: Ollama (qwen2.5:3b, localhost:11434) — can be switched to remote via config
- Connectors: Claude Code + Kilo Code enabled

---

## 11. What's Built vs What's Pending

### ✅ Built and Functional

- Full PostgreSQL migration schema (13 files, 8 core + 3 TimescaleDB + 2 RLS)
- PostgresStore with full CRUD for all tables
- SupabaseStore extending Postgres with auth integration
- PermissionManager with role caching
- KnowledgeBaseEngine with vector + FTS search
- Connector registry with 3 connectors (Claude, Kilo, FileSystem)
- Memory enrichment pipeline (classifier, extractor, embedder)
- LlamaIndex.TS RAG engine with Ollama embeddings
- OpenTelemetry SDK (traces, metrics, logs, benchmarking)
- 14 CLI commands (init, daemon, ingest, search, ask, timeline, hooks, memory, inject, status, connectors, setup, team, perm, kb)
- TUI components (status bar, memory list, timeline, setup wizard)
- Docker compose (personal, team, enterprise)
- 8 CI/CD workflows
- Full documentation (24 files)
- GitHub issues (18 open, properly labeled and linked)

### ⏳ Pending Implementation

- Team management CLI commands (file exists, needs to be wired into command registration)
- Permission CLI commands (file exists, needs to be wired into command registration)
- Knowledge base CLI commands (file exists, needs to be wired into command registration)
- LLM-based decision extraction (currently regex-based)
- Real-time event streaming (watch mode for connectors)
- Context injection for SessionStart hooks
- Supabase Realtime subscriptions
- Full test suite
- Migration runner script
- Additional connectors (Cursor, Windsurf, VS Code, Aider, Cline, Codex, Gemini CLI, Devin)

---

## 12. Coding Standards

### TypeScript

- **Strict mode** enabled in tsconfig.json
- **ESM modules** — use `.js` extensions in imports (TypeScript resolves to `.ts`)
- **`import type`** for type-only imports
- **ESLint + Prettier** — run `bun run lint` and `bun run format` before committing
- **JSDoc** — document all public functions, types, and constants

### Git

- **Conventional commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`, `ci:`, `build:`, `revert:`, `deps:`
- **Branch naming** — `feature/description`, `bugfix/description`, `hotfix/description`
- **PR titles** — must follow conventional commit format (enforced by CI)
- **Squash merge** — all PRs should be squash merged to main

### Testing

- **Bun test** — `bun run test`
- **Coverage target** — 80%+
- **Integration tests** — require PostgreSQL service (TimescaleDB)

### Dependencies

- **Only free/open-source** — no paid dependencies
- **Security audit** — run `bun audit` before adding new dependencies
- **No hardcoded secrets** — use environment variables or config files (gitignored)

---

## 13. Important Conversation History

### Key Decisions Made

1. **Go → TypeScript** — User changed from Go to TypeScript mid-project. All Go code was discarded and rebuilt in TypeScript.
2. **SQLite → PostgreSQL** — User explicitly dropped SQLite in favor of PostgreSQL + Supabase + TimescaleDB. User is building a data bottleneck and needs multi-user, multi-team, permissions, and time-series analytics. SQLite cannot handle this.
3. **Mem0/Letta → Custom** — User decided against using Mem0 or Letta as the memory backend. Built custom enrichment layer on top of PostgreSQL with pgvector.
4. **Personal → Team-first** — User wants team features from the start: user management, permissions, data sharing, knowledge base accessible to all team members.
5. **Time-series is critical** — User wants to accumulate "a ton of data" — logs, errors, warnings, results, network traffic, conversations, ETL. TimescaleDB hypertables with automatic compression and retention are essential.
6. **Knowledge base is a first-class feature** — Not just raw memories, but a curated, versioned, searchable knowledge base that AI agents can pull from. With visibility controls and edit history.
7. **Security at the database level** — RLS policies on every table. Managers assign permissions. Users only see what they're allowed to see.

### User's Vision

- "A bottleneck or aggregator for all things AI agent"
- "Universal memory shared across instances, conversations, AI agents"
- "System that works behind the scenes by gathering, aggregating and organizing and storing and recalling data"
- "For teams that are working together on the same project we could setup these orchestrator agent to aggregate team data together so your agent would know what your teammate is doing"
- "Could provide you with updates on what your teammate is doing"
- "Stop you from duplicating efforts or could help you synergize work"

### Things to Remember

- The user switches between Windows and Linux environments
- The user values speed — "this is taking forever" feedback means we need to batch operations and commit frequently
- The user wants everything to be free — no paid APIs, no subscriptions
- The purple octopus/squid mascot is important to the user
- The name "nautalis" was chosen over alternatives (mantle, chroma, cephalo, kraken, inkwell, tentacle)

---

## 14. Quick Reference

### Common Commands

```bash
bun install                    # Install dependencies
bun run dev                    # Run with watch mode
bun run build                  # Build for production
bun run test                   # Run tests
bun run lint                   # Lint code
bun run typecheck              # Type check
bun run db:migrate             # Run database migrations

# CLI usage
nautalis init                  # Initialize
nautalis ingest                # Import existing sessions
nautalis search "query"        # Search memories
nautalis ask "question"        # RAG-powered Q&A
nautalis timeline --since 2d   # View recent activity
nautalis status                # Check current state
nautalis team create "My Team" # Create a team
nautalis kb search "auth"      # Search knowledge base
```

### Docker

```bash
# Personal
docker compose -f docker/docker-compose.yml up -d

# Team
docker compose -f docker/docker-compose.team.yml up -d

# Enterprise
docker compose -f docker/docker-compose.enterprise.yml up -d
```

### Database

```bash
# Connect to PostgreSQL
psql "postgresql://nautalis:nautalis@localhost:5432/nautalis"

# Run migrations manually
for f in migrations/postgres/core/*.sql; do
  psql -f "$f"
done
for f in migrations/postgres/timescaledb/*.sql; do
  psql -f "$f"
done
for f in migrations/postgres/rls/*.sql; do
  psql -f "$f"
done
```

---

## 15. When in Doubt

1. **Check the migrations** — `migrations/postgres/` has the definitive schema
2. **Check the types** — `src/types/` has all TypeScript interfaces
3. **Check the store interface** — `src/store/interface.ts` defines what the store must do
4. **Check existing connectors** — `src/connectors/claude-code.ts` is the reference implementation
5. **Check the RLS policies** — `migrations/postgres/rls/001_rls_policies.sql` defines all security rules
6. **Ask** — If something is unclear, the conversation history above has the reasoning behind every decision

---

## 16. Development Environment Setup

### PostgreSQL Database

Nautalis requires a PostgreSQL 16+ database with TimescaleDB and pgvector extensions installed. For development, you can either:

- **Use an existing bare-metal PostgreSQL** (default): Ensure extensions are installed and set `DATABASE_URL` environment variable, e.g.:
  ```bash
  export DATABASE_URL=postgresql://nautalis:nautalis@localhost:5432/nautalis
  ```
  Then run `bun run db:migrate` to apply migrations, or use `nautalis init` which will attempt migrations automatically.

- **Use Docker Compose** (for full stack with observability): The provided `docker/docker-compose.yml` starts nautalis, OpenTelemetry Collector, Jaeger, and Grafana. **It does NOT start PostgreSQL** — it expects an external database. Configure `DATABASE_URL` either in a `.env` file or as an environment variable before running `docker compose up -d`.

### Running with Docker Compose (Observability Stack)

1. Ensure your bare-metal PostgreSQL is running and accessible at `localhost:5432` with database `nautalis` and user `nautalis`.
2. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.
3. Bring up the stack:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```
4. Initialize the database inside the nautalis container:
   ```bash
   docker exec docker-nautalis-1 bun run dist/cli.js init
   ```
 5. Access services:
    - Nautalis daemon: http://localhost:3002
    - Jaeger UI: http://localhost:16686
    - Grafana: http://localhost:4000 (admin/admin)
    - OTel Collector endpoints: http://localhost:4317 (gRPC), http://localhost:4318 (HTTP)

### Notes

- The `docker-compose.yml` maps container port 3001 to host port 3002 and uses `extra_hosts` to reach the host's PostgreSQL at `host.docker.internal`.
- If you need to run everything in Docker (including PostgreSQL), use `docker-compose.team.yml` or `docker-compose.enterprise.yml` which include database services. Those are for team/enterprise deployments and self-contained testing.
- Always run `bun run typecheck` and `bun test` before committing.
- Current test coverage: >80% (196 passing tests).

