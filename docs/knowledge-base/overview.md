# What is Nautalis?

Nautalis is a **Universal AI Agent Memory & Orchestration Platform** that aggregates memory, context, and intelligence across all your AI coding tools.

## The Problem

In 2026, developers use multiple AI coding agents:
- **Claude Code** for complex reasoning
- **Kilo Code** for quick edits
- **Cursor** for IDE integration
- **Windsurf** for flow state coding
- **OpenCode** for open-source workflows

Each agent is a **silo** — no shared memory, no cross-agent awareness, no centralized knowledge. When you switch between agents, context is lost. When teammates work on the same project, duplicate effort happens.

## The Solution

Nautalis sits behind all your AI agents and:

1. **Aggregates** every event — tool calls, file edits, commands, decisions, errors
2. **Enriches** with rich metadata — agent identity, project context, classification, relationships
3. **Stores** with vector embeddings — semantic search across all AI activity
4. **Synthesizes** cross-agent context — unified view of what's happening
5. **Injects** smart context — feeds relevant memories into new sessions
6. **Observes** everything — OpenTelemetry traces, logs, metrics for diagnosis and benchmarking

## Key Features

- **Connector System** — Pluggable integrations for every AI tool
- **Memory Engine** — Classification, decision extraction, importance scoring
- **LlamaIndex.TS RAG** — Retrieval-Augmented Generation for intelligent queries
- **OpenTelemetry Pipeline** — Full observability with traces, logs, metrics, benchmarking
- **Context Injection** — Smart relevance scoring for session preparation
- **Team Coordination** — Conflict detection, activity feeds, shared memory
- **Zero Cost** — SQLite + Ollama = fully offline, fully free

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    NAUTALIS                         │
│                                                     │
│  Connectors → Memory Engine → LlamaIndex RAG       │
│  (Claude,    (Classify,       (Retrieve,            │
│   Kilo,       Extract,         Synthesize,           │
│   Cursor,     Score,           Query)                │
│   etc.)       Relate)                                │
│                                                     │
│  OpenTelemetry Pipeline                              │
│  (Traces, Logs, Metrics, Benchmarking)               │
│                                                     │
│  Storage: SQLite (default) / PostgreSQL / Supabase  │
│  Embeddings: Ollama (default) / OpenAI / Cohere     │
│                                                     │
│  Interfaces: CLI · TUI · REST API · MCP Server      │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
bun install -g @nautalis/orchestrator

# Initialize
nautalis init

# Ingest existing sessions
nautalis ingest

# Search
nautalis search "database migration"

# Ask questions
nautalis ask "what did I decide about auth?"

# View timeline
nautalis timeline --since 2d
```

## Who Is Nautalis For?

| User | Use Case |
|------|----------|
| Solo Developer | Never lose context between sessions or agents |
| Small Team | Shared memory, conflict detection, activity awareness |
| Enterprise | Centralized AI governance, audit trails, compliance |
| AI Agent Developer | Rich context injection, memory-backed conversations |

## Core Concepts

### Memory

Memory in Nautalis is not just a log of events. It's a **structured, enriched, searchable knowledge graph** that captures:

- What happened (the event)
- Who did it (the agent)
- Why it matters (classification, importance)
- How it relates (connections to other memories)
- When it occurred (temporal context)

### Connectors

Connectors are pluggable integrations that bridge Nautalis with external AI tools. Each connector:

- Reads events from the agent's native format
- Translates them into Nautalis's unified schema
- Streams them into the memory engine
- Optionally receives context back for injection

### Context Injection

When a new AI session starts, Nautalis can inject relevant prior context:

- Recent decisions and their rationale
- Related code patterns and lessons learned
- Team activity that might affect the current work
- Warnings about known pitfalls

### Observability

Every operation in Nautalis is instrumented with OpenTelemetry:

- **Traces** follow events from connector ingestion through memory storage
- **Logs** capture structured diagnostic information
- **Metrics** track system health, performance, and usage patterns
- **Benchmarks** measure agent performance over time

## Next Steps

- Read the [Architecture Guide](architecture.md) for a deep dive
- Follow the [Getting Started Guide](../guides/getting-started.md) to set up Nautalis
- Explore [Connectors](connectors.md) to integrate your AI tools
