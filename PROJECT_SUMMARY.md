# Nautalis — Universal AI Agent Memory & Orchestration Platform

## Current Status

- **Version:** 0.1.0 (Early Alpha)
- **Production Readiness:** 35%
- **Implementation Completeness:** ~60%
- **MVP Timeline:** 8-12 weeks
- **Test Coverage:** 0%
- **Design vs Implementation Gap:** Significant (95% designed, 30% implemented)

### Top Priorities (Next 90 Days)

1. **Define MVP scope** — Reduce from 70+ requirements to essential 30%
2. **Validate connectors** — Test Claude Code hooks on real installations
3. **Complete RAG pipeline** — Bridge LlamaIndex to PostgreSQL for search
4. **Implement test suite** — 80%+ coverage for confident development
5. **Add SQLite option** — Lower barrier to entry for solo developers
6. **Implement error resilience** — Retry, circuit breakers, graceful degradation
7. **Benchmark performance** — Meet latency targets (embedding <200ms, search <500ms)

### What is Nautalis?

Nautalis is a **Universal AI Agent Memory & Orchestration Platform** that provides shared, cross-agent memory infrastructure for AI coding tools and autonomous agents. Built with TypeScript, LlamaIndex.TS, and OpenTelemetry, it aggregates events from all AI agents, stores them with rich metadata, and provides cross-agent context synthesis — enabling any AI agent to understand what any other agent has done, learned, or decided.

### The Problem

In 2026, developers use multiple AI coding tools simultaneously — **Claude Code**, **Kilo Code**, **Cursor**, **Windsurf**, **GitHub Copilot**, and others. Each tool operates in complete isolation:

- **No shared memory**: Agent A has no idea what Agent B did yesterday
- **Lost context**: Switching between tools means losing all accumulated context
- **Duplicated work**: Multiple agents independently discover the same patterns
- **No team visibility**: Cannot see what AI agents across a team have learned
- **Zero observability**: No way to track, audit, or analyze AI agent behavior over time

Existing memory solutions (Mem0, Letta, Zep) are **single-agent focused** — they optimize memory for one agent's session, not across the entire ecosystem of tools a developer uses.

### The Solution

Nautalis acts as a **universal memory layer** that sits between all AI agents and provides:

1. **Connectors** — Pluggable integrations for every AI coding tool (Claude Code, Kilo Code, Cursor, Windsurf, Copilot, etc.) that capture events, decisions, and context
2. **Memory Engine** — LlamaIndex.TS-powered RAG pipeline with semantic search, embeddings, and context retrieval across all agents
3. **Rich Metadata** — Every memory is tagged with agent identity, context, classification, relationships, and lifecycle metadata
4. **Context Injection** — Real-time context delivery to any agent, synthesized from the full cross-agent memory graph
5. **Team Sync** — Shared memory pools for teams, with role-based access and cross-agent knowledge transfer
6. **Observability Pipeline** — Full OpenTelemetry instrumentation for traces, logs, and metrics across all agent activity

### Tech Stack

| Layer                | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| **Runtime**          | Bun (fast, native TypeScript)                        |
| **Language**         | TypeScript (strict mode)                             |
| **RAG / Embeddings** | LlamaIndex.TS                                        |
| **Observability**    | OpenTelemetry (traces, logs, metrics)                |
| **Storage**          | SQLite (personal) / PostgreSQL (team/enterprise)     |
| **Embeddings**       | Ollama (local, zero-cost) / OpenAI / cloud providers |
| **CLI**              | commander.js                                         |
| **TUI**              | ink (React-based terminal UI)                        |
| **API**              | Hono (lightweight, fast HTTP framework)              |
| **MCP**              | Model Context Protocol server                        |

### Zero-Cost Design

Nautalis is designed to run at **zero cost** for individual developers:

- **Ollama** for local embeddings (no API calls, no costs)
- **SQLite** for local storage (no database server needed)
- **All open-source** dependencies (no licensing fees)
- **Offline-first** architecture (works without internet)
- **Self-hosted** observability (OpenTelemetry Collector + local storage)

Teams and enterprises can scale up with PostgreSQL, cloud embeddings, and managed observability backends.

### Target Users

| User                    | Use Case                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Solo Developers**     | Personal memory across multiple AI coding tools, never lose context             |
| **Small Teams**         | Shared memory pool, cross-agent knowledge transfer, team visibility             |
| **Enterprises**         | Full observability pipeline, audit trails, compliance, multi-team orchestration |
| **AI Agent Developers** | SDK for building agents with persistent, shared memory                          |

### Key Features

#### Connector System

- Pluggable architecture for AI tool integrations
- Auto-registration via registry pattern
- Support for Claude Code, Kilo Code, Cursor, Windsurf, Copilot, and custom agents
- Event capture: commands, file edits, decisions, errors, context

#### Memory Enrichment

- Automatic classification and tagging of memories
- Semantic embeddings via LlamaIndex.TS
- Relationship extraction between memories
- PII detection and redaction
- Confidence scoring and relevance ranking

#### Context Injection

- Real-time context retrieval for any agent
- Cross-agent synthesis (what did other agents learn about this codebase?)
- Configurable context windows and relevance thresholds
- Temporal context (what happened recently vs. historically)

#### Team Sync

- Shared memory pools with role-based access
- Cross-agent knowledge transfer between team members
- Agent identity management and attribution
- Conflict resolution for overlapping memories

#### Observability Pipeline

- Full OpenTelemetry instrumentation
- Distributed traces across agent interactions
- Structured logs with memory context
- Metrics: memory count, query latency, embedding performance, connector health
- Benchmarking pipeline for continuous performance tracking

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Nautalis Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Claude  │  │   Kilo   │  │  Cursor  │  │  Custom  │    │
│  │  Code    │  │   Code   │  │          │  │  Agents  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│  ┌────┴──────────────┴──────────────┴──────────────┴─────┐  │
│  │              Connector Layer (Registry)                │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────┴─────────────────────────────┐  │
│  │              Memory Engine (LlamaIndex.TS)            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Enrich   │  │ Embed    │  │ Classify & Tag   │   │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────┴─────────────────────────────┐  │
│  │              Storage Layer                           │  │
│  │     SQLite (local) / PostgreSQL (team/enterprise)    │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                 │
│  ┌────────────────────────┴─────────────────────────────┐  │
│  │              Context Injection Layer                 │  │
│  │     RAG Retrieval → Synthesis → Agent Delivery       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         OpenTelemetry Observability Pipeline         │   │
│  │         Traces │ Logs │ Metrics │ Benchmarks         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Quick Start

```bash
# Install dependencies
bun install

# Start with local defaults (SQLite + Ollama)
bun run start

# Run with team configuration
bun run start --config config/team.yaml

# Query memory
nautalis query "what did I learn about the auth module?"

# Check agent activity
nautalis agents list

# View observability dashboard
nautalis telemetry status
```

### Project Structure

```
nautalis/
├── src/
│   ├── connectors/      # AI tool integrations
│   ├── memory/          # Memory engine, RAG, embeddings
│   ├── store/           # Storage backends (SQLite, PostgreSQL)
│   ├── telemetry/       # OpenTelemetry instrumentation
│   └── orchestration/   # Intelligence layer, context synthesis
├── config/              # Configuration files
├── migrations/          # Database migrations
├── test/                # Test suites
├── docker/              # Docker configurations
├── hooks/               # Git hooks
└── docs/                # Additional documentation
```

### Documentation

- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) — This file: high-level overview
- [CONTEXT.md](./CONTEXT.md) — Background, problem space, design philosophy
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) — Feature completeness and implementation gaps
- [AGENTS.md](./AGENTS.md) — AI agent instructions for working on this project
- [RULES.md](./RULES.md) — Project rules, conventions, and standards
- [SRS.md](./SRS.md) — Software Requirements Specification

### License

MIT — Free and open source.
