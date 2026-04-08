# 🐙 Nautalis

[![CI](https://github.com/cbwinslow/nautalis/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/cbwinslow/nautalis/actions/workflows/ci.yml)
[**Documentation**](./FEATURES.md) • [**Status**](./IMPLEMENTATION_STATUS.md) • [**AGENTS**](./AGENTS.md)

**Universal AI Agent Memory & Orchestration Platform**

Nautalis sits behind all AI coding agents (Claude Code, Kilo Code, Cursor, etc.) and aggregates their activity into a unified, searchable memory store with intelligent context injection. Stop working in silos — let your AI assistant know what you did yesterday, last week, or across teammates.

---

## 🚀 Quick Start

```bash
# Prerequisites: PostgreSQL 16+ with extensions (pgvector, timescaledb, pg_trgm, uuid-ossp)
# Or use Docker Compose (includes database on host)

# 1. Install and initialize
bun install
DATABASE_URL=postgresql://nautalis:nautalis@localhost:5432/nautalis bun run cli.ts init

# 2. Start the daemon (HTTP API + optional hooks)
bun run cli.ts daemon start --port 3002

# 3. Ingest existing sessions (Claude Code, Kilo Code)
bun run cli.ts ingest --async

# 4. Search memories
bun run cli.ts search "authentication flow"

# 5. Ask questions (RAG)
bun run cli.ts ask "How did we handle errors in the API?"
```

**See also:** [Deployment Guide](./docs/deployment.md) for Docker and production setups.

---

## ✨ Features

- **Universal Connectors** — Import sessions from Claude Code, Kilo Code, Cursor, and generic filesystem sources
- **Rich Memory Enrichment** — Auto-classify memory type, extract decisions, detect topics, and redact PII
- **Hybrid Search** — Combines vector similarity and PostgreSQL full-text search for best recall
- **Context Injection** — Semantic CLI and background daemon inject relevant past activity into new sessions
- **Multi-Provider LLM & Embeddings** — Use Ollama (default), OpenAI, Anthropic, Cohere, or any REST-compatible endpoint
- **Team & RBAC** — Multi-team support with role-based permissions and audit logging
- **Observability** — Full OpenTelemetry integration (traces, metrics, logs) with Jaeger + Grafana
- **Rate Limiting** — Protect daemon endpoints against abuse
- **Interactive Setup Wizard** — `nautalis setup` guides first-time users through configuration

**Status:** Early Alpha (~99% MVP complete) | [Detailed Status](./IMPLEMENTATION_STATUS.md)

---

## 🧠 How It Works

1. **Ingest** events from AI agent logs/sessions via CLI or daemon hooks
2. **Enrich** each event: classify memory type, extract decisions, generate embedding, detect sensitivity
3. **Store** in PostgreSQL with TimescaleDB hypertables and pgvector indexes
4. **Retrieve** via hybrid search (vector + FTS) or timeline queries
5. **Inject** relevant context into new AI sessions based on semantic similarity

---

## 🔌 Supported AI Agents

| Agent | Status | Features |
|-------|--------|----------|
| Claude Code | ✅ | Hooks (PostToolUse, Stop, SessionStart/End), transcript parsing |
| Kilo Code | ✅ | JSONL session parser |
| Cursor | ✅ | Session & completion capture |
| Generic Filesystem | ✅ | Custom JSON/JSONL import |

**Connector validation on real installations is pending** (see #12, #14).

---

## 🛠️ Installation & Configuration

### Option 1: Docker Compose (Recommended)

```bash
docker compose -f docker/docker-compose.yml up -d
# Then run init inside container
docker exec docker-nautalis-1 bun run dist/cli.js init
```

**Note:** Docker Compose uses an external PostgreSQL on host by default. See [deployment.md](./docs/deployment.md).

### Option 2: Bare Metal

```bash
# Install dependencies
bun install

# Create .env from example
cp .env.example .env
# Edit .env with your DATABASE_URL

# Initialize database (creates tables, extensions, RLS policies)
bun run cli.ts init
```

Configuration file: `.nautalisrc.json` (or TOML/YAML). Use `nautalis setup` for interactive creation.

**Default providers:** Ollama for both embeddings (`nomic-embed-text`) and LLM (`qwen2.5:3b`) on `localhost:11434`.

---

## 📖 Documentation

| Guide | Purpose |
|-------|---------|
| [FEATURES.md](./FEATURES.md) | Detailed feature list and MVP scope |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Component-wise completion percentages |
| [AGENTS.md](./AGENTS.md) | Instructions for AI agents working on this project |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [docs/deployment.md](./docs/deployment.md) | Production deployment steps |
| [docs/](./docs/) | Additional design notes and decisions |

---

## 🧪 Testing

```bash
# Unit + integration
bun test

# With coverage
bun run test --coverage

# Specific test file
bun test test/unit/memory-engine.test.ts
```

**Current:** 215 passing tests across 27 files (~80% function coverage).

---

## 🤝 Contributing

This project is in early alpha. Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md) before submitting PRs. Ensure `bun run lint` and `bun run typecheck` pass.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

## 🐛 Known Issues & Roadmap

- **Connector validation** — Need to test hooks on actual Claude/Kilo installations (#12, #14)
- **RLLM advanced features** — Relationship extraction, persistent index improvements (not blocking MVP)
- **Supabase Realtime** — Not yet implemented (team features use application-level RBAC for now)

For full roadmap and blocking issues, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

---

Built with ❤️ by the Nautalis team.
