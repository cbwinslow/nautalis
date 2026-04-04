# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Comprehensive Project Analysis (2026-04-03)** — Complete review of architecture, implementation status, and strategic recommendations
- **Documentation** — Implementation Status tracking, comprehensive review analysis, updated project summary with current state
- **RAG Pipeline** — LlamaIndex.TS integration with Ollama embeddings, vector search via pgvector, and LLM-based synthesis (Ollama)
- **Search & Ask Commands** — Functional `nautalis search` and `nautalis ask` commands with semantic retrieval and synthesis
- **Memory Engine** — Event processing pipeline with classification, decision extraction, and embedding generation; teamId enforcement
- **PostgreSQL Storage** — Full schema with TimescaleDB hypertables, pgvector, RLS policies, and Drizzle ORM integration
- **Connector Framework** — Registry pattern with Claude Code, Kilo Code, and FileSystem connectors (hooks + transcript parsing)
- **CLI** — 14 commands implemented: init, ingest, search, ask, timeline, status, hooks, memory, inject, connectors, setup, daemon, team, permissions, knowledge-base
- **OpenTelemetry** — Telemetry SDK with spans, metrics, logs, and benchmarking utility
- **Configuration System** — Cosmiconfig with TOML support, environment overrides
- **Permission System** — RBAC with role caching, team membership management; **partial enforcement now in place for memory operations** (insertMemory, getMemory, listMemories, queryMemories, findSimilarMemories, updateMemory, deleteMemory)
- **Knowledge Base** — Database schema with versioning, visibility controls, and search (CRUD partially implemented, permissions pending)
- **Runtime Validation** — Zod schemas for all domain types (config, events, memories, knowledge base); validated at startup and ingest points to ensure data integrity
- **Error Resilience** — Retry with exponential backoff + circuit breaker for external services: embedding API, LLM API, and database operations (transient error handling)
- **Event Storage** — Raw events are now stored during ingestion, providing audit trail and enabling replay
- **Connector Testing** — Added test script `scripts/test-claude-parser.ts` to validate Claude Code transcript parsing with sample fixture
- **RAG-to-Store Integration** — RAGEngine now uses LlamaIndex index when available, with automatic index building on first query; falls back to raw pgvector. Bridge between LlamaIndex and PostgreSQL completed.
- **PII Detection** — Automatic redaction of sensitive data (emails, phones, credit cards, API keys, passwords in URLs) from events before storage; configurable via guardrails.piiDetection
 - **Unit Tests** — Added initial test suite for PII detector (10 passing tests); foundation for test infrastructure
 - **Daemon Server** — HTTP daemon (`nautalis daemon start`) with endpoints to support Claude Code hooks: `/api/events` (ingest), `/api/context/inject` (context injection), `/api/sessions/summarize` and `/api/sessions/finalize`
 - **Semantic Injection** — `nautalis inject` now supports `--query` flag for RAG-based retrieval; falls back to recent memories when no query provided
 - **Audit Logging** — Comprehensive audit trail for sensitive operations: memory delete/update, permission grants/revokes, team management (createTeam, addTeamMember, removeTeamMember, updateMemberRole, updateTeam), and knowledge base create/update/delete
 - **Relationship Retrieval** — Store method `getRelatedMemories` to traverse memory relationships (parent, child, supersedes, supersededBy, contradicts, contradictedBy, supports, supportedBy, all)

### Changed

- **Default Storage** — Documentation indicates SQLite as default, but implementation remains PostgreSQL-only (design debate ongoing)
- **RAG engine** — Fixed missing dependencies (store, embeddingService); synthesis now uses LLM directly
- **Ask command** — Now uses integrated `MemoryEngine.ask()` method
- **Permission enforcement** — Extended `withTeamContext` to all memory, knowledge base, and team management operations, ensuring multi-tenant security

### In Progress

- **MVP Definition** — Reducing scope from 70+ requirements to 30% for first functional release (issue #42)
- **Connector Validation** — Testing Claude Code hooks on real installations (critical path)
- **RAG Integration** — Completing LlamaIndex index building from memories (search currently uses raw pgvector)
- **Test Infrastructure** — Setting up test suite, aim for 80%+ coverage (issue #34)
- **PII Detection** — Implementing redaction to protect sensitive data (issue #47)
- **Performance Benchmarking** — Measuring and optimizing embedding/search latency (issue #45)
- **Setup Wizard** — Interactive onboarding to lower barrier (issue #46)
- **SQLite Fallback** — Adding SQLite for local/solo use (issue #43)

### Completed Code Fixes (2026-04-04)

- Fixed RAGEngine constructor to receive store and embeddingService dependencies
- Added teamId enforcement in MemoryEngine (falls back to config)
- Implemented RAG synthesis using LLM (was TODO)
- Added MemoryEngine.ask() method combining retrieval + synthesis
- Simplified ask command to use new integrated method
- Implemented permission checking infrastructure:
  - Added `withTeamContext` helper to PostgresStore for RLS and permission enforcement
  - Updated Store interface to include userId/teamId options for memory methods
  - Enforced permissions in: insertMemory, getMemory, listMemories, queryMemories, findSimilarMemories, updateMemory, deleteMemory
  - Updated MemoryEngine to pass userId/teamId to store
  - Updated CLI commands (timeline, memory, inject) to pass userId
   - Updated RAGEngine to accept and pass userId
 - All TypeScript errors resolved
 - Extended permission enforcement to Knowledge Base and Team operations (issues #52, #53)
 - Added multi-provider LLM support for RAG synthesis (OpenAI, Anthropic, custom endpoints)
 - Implemented RAGEngine.buildIndex() to load memories from database (foundation for advanced retrieval)
 - Updated Claude Code hooks to use configurable NAUTALIS_SERVER_URL (supports remote deployments)

### Known Issues

- **Default Storage** — Documentation indicates SQLite as default, but implementation remains PostgreSQL-only (design debate ongoing)

### In Progress

- **MVP Definition** — Reducing scope from 70+ requirements to essential 30% for first functional release (issue #42)
- **Connector Validation** — Testing Claude Code hooks on real installations (critical path)
 - **RAG Integration** — Index building implemented and multi-provider LLM support added; need to integrate LlamaIndex query engine (currently uses raw pgvector)
- **Error Resilience** — Adding retry logic, circuit breakers, and graceful degradation (issue #44)
 - **Test Suite** — Setting up test infrastructure with 80%+ coverage target (issue #34)
 - **Performance Benchmarking** — Measuring and optimizing embedding/search latency (issue #45)
 - **Security** — Implementing PII detection, input validation, secret scanning (issue #47)
- **User Onboarding** — Interactive setup wizard to lower barrier to entry (issue #46)
- **SQLite Support** — Adding SQLite as alternative backend for local development (issue #43)

### Known Issues

- **RAG Pipeline** — Search uses direct pgvector queries; LlamaIndex index built but not used by query engine. Hybrid search pending.
- **Embeddings/LLM** — Multi-provider support added (OpenAI, Anthropic, custom), but requires configuration and API keys.
- **Connectors** — Claude/Kilo connectors exist but untested on real data; Cursor/Windsurf not started
- **Tests** — Zero test coverage currently; regressions likely
- **Error Handling** — Minimal resilience; transient failures can crash system
- **TUI** — Components stubbed but not integrated; Dashboard not implemented
- **Context Injection** — Not connected to SessionStart hooks
- **PII Detection** — Not implemented; sensitive data stored verbatim

### Completed Code Fixes (2026-04-03 to present)

- Fixed RAGEngine constructor to receive store and embeddingService dependencies
- Added teamId enforcement in MemoryEngine (falls back to config)
- Implemented RAG synthesis using configured LLM
- Added MemoryEngine.ask() method combining retrieval + synthesis
- Simplified ask command to use new integrated method
- All TypeScript errors resolved

---

### Deprecated

### Removed

### Fixed

### Security

---

## [0.1.0] - 2024-01-15

### Added

- Initial project scaffold
- TypeScript configuration
- ESLint and Prettier setup
- Basic test infrastructure with Bun
- CI/CD pipeline with GitHub Actions
- Contributing guidelines and code of conduct

[Unreleased]: https://github.com/nautalis/nautalis/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nautalis/nautalis/releases/tag/v0.1.0
