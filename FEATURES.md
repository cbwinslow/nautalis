# Nautalis — Feature Goals & MVP Definition

**Last Updated:** 2026-04-04  
**Implementation Status:** ~60% complete  
**Target MVP:** Minimal viable system for single-team deployment

---

## Mission

Build the **universal memory layer** that connects all AI agents, enabling cross-agent knowledge sharing, team collaboration, and full observability of AI activity.

---

## MVP Definition (v0.1.0)

The MVP must deliver a **working system** that can be deployed by a small team and immediately provides value by:

1. **Ingesting** events from at least one AI agent (Claude Code or Kilo Code)
2. **Storing** enriched memories with vector embeddings (PostgreSQL + pgvector)
3. **Retrieving** similar memories via semantic search
4. **Answering questions** by synthesizing context from memories using an LLM
5. **Enforcing** multi-tenant security (RBAC + RLS) for team data isolation
6. **Providing** CLI for all core operations
7. **Capturing** structured logs for basic observability

---

## Feature Categories & Status

| Category | Implementation | Core for MVP? |
|----------|----------------|---------------|
| **Storage Backend** | ✅ 100% — PostgreSQL + pgvector + TimescaleDB | ✅ Essential |
| **Multi-tenancy** | ✅ 100% — RBAC with RLS enforcement | ✅ Essential |
| **Event Ingestion** | 🟨 60% — REST API works, connectors need validation | ✅ Essential |
| **Memory Enrichment** | 🟨 50% — Classification, extraction, embedding work | ✅ Essential |
| **RAG Retrieval** | 🟨 60% — Vector search via pgvector (cosine similarity) | ✅ Essential |
| **RAG Synthesis** | ✅ 80% — Multi-provider LLM (Ollama, OpenAI, Anthropic, custom) | ✅ Essential |
| **Knowledge Base** | ✅ 100% — CRUD, search, versioning, visibility | ✅ Essential |
| **CLI Commands** | ✅ 80% — All 14 commands registered and mostly functional | ✅ Essential |
| **Observability** | 🟨 30% — Structured logging (pino) works; OTel stub | ✅ Basic |
| **Error Resilience** | ❌ 0% — No retry, circuit breakers, or graceful degradation | ⬜ Defer |
| **PII Detection** | ❌ 0% — No redaction or secret scanning | ⬜ Defer (security) |
| **Context Injection** | 🟨 10% — Recency-based only, not semantic | ⬜ Post-MVP |
| **Test Suite** | ❌ 0% — Zero coverage, no tests | ⬜ Post-MVP |
| **TUI / Dashboard** | ❌ 0% — Components stubbed, not integrated | ⬜ Post-MVP |
| **Connector SDK** | 🟨 25% — Framework exists, hooks configurable; untested | ⬜ Defer |

---

## Core Features (MVP Must-Have)

### ✅ Completed & Ready

- PostgreSQL schema with TimescaleDB hypertables, pgvector, RLS policies
- Permission system with role-based access control (owner/admin/manager/member/viewer)
- `Store` abstraction with full implementation for all domains
  - Memories (CRUD, vector search, embeddings)
  - Knowledge Base (CRUD, vector + full-text search)
  - Teams, Projects, Agents, Sessions
  - Events, Audit log, Telemetry
- Memory enrichment pipeline:
  - `MemoryClassifier` (episodic/semantic/procedural/decision/lesson/preference)
  - `DecisionExtractor` (pattern-based, ready for LLM upgrade)
  - `EmbeddingService` with remote endpoint support (custom provider)
- RAG engine:
  - Vector retrieval via `findSimilarMemories`
  - Multi-provider LLM synthesis (Ollama, OpenAI, Anthropic, custom)
  - `buildIndex()` to load memories into LlamaIndex (foundation for advanced search)
- CLI commands (all working):
  - `nautalis init`, `ingest`, `search`, `ask`
  - `memory` (list, get, delete)
  - `knowledge-base` (create, get, list, search, delete)
  - `team` (create, use, list, info, invite, role, remove)
  - `permissions` (check, grant, revoke, matrix)
  - `status`, `hooks`, `connectors`, `setup`, `daemon`, `inject`, `timeline`
- Team management with permission enforcement
- Configurable Claude Code hooks via `NAUTALIS_SERVER_URL`
 - Remote endpoint support for all services (Tailscale-ready)
 - **Configuration validation**: Zod schemas for config and events, validated at startup and ingest points

### ⬜ Needs Completion for MVP

- **Connector validation**: Actually install and test Claude Code hooks on real project
  - Verify `record-event.js`, `summarize-session.js`, `inject-context.js` work end-to-end
  - Test real-time ingestion and session lifecycle
  - Issue: #12, #14
- **Basic telemetry**: Switch from in-memory metrics to real OTel exporter or at least persistent logs
  - Current `provider.ts` uses pino but needs OTLP integration
  - Ensure all spans and metrics are actually recorded and exportable
  - Issue: #22
- **Error handling**: Implement retry logic with exponential backoff for external calls (embedding API, LLM API, database)
  - Add circuit breaker for failing services
  - Issue: #44
- **Performance tuning**: Benchmark embedding latency, search latency, synthesis latency; optimize queries and add missing indexes
  - Ensure search <500ms p95, embedding <200ms p95
  - Issue: #45

---

## Extended Features (Post-MVP)

### Security & Compliance

- **PII Detection & Redaction** — Auto-detect emails, phones, API keys, passwords in raw events; redact or hash before storage (#47)
- **Input Validation** — Schema validation for all incoming data (config, events, API requests)
- **Audit Logging** — Call `logAudit()` for sensitive operations (memory changes, KB edits, permission changes)
- **Resource Sharing** — Cross-team and cross-user resource sharing (design exists, implementation pending)

### Advanced RAG

- **Hybrid Search** — Combine vector + BM25 (keyword) for better recall
- **Reranking** — Use cross-encoder to rerank top-k results
- **LlamaIndex Query Engine** — Switch from raw SQL to LlamaIndex's query engine with configurable retrievers and synthesizers
- **Relationship Retrieval** — Traverse memory parent/child/supersedes/contradicts/supports links
- **Multi-modal** — Support images, audio transcripts (future)

### Quality & Reliability

- **Comprehensive Test Suite** — Unit tests for all services, integration tests for store, E2E tests for ingestion → retrieval
- **Error Resilience** — Retries, circuit breakers, fallback behavior, graceful degradation
- **Backfill & Replay** — Ability to re-process events from a date range with new enrichment logic
- **Schema Migration** — Safe migration system for evolving data model without downtime

### Developer Experience

- **Context Injection** — Semantic context injection into AI agent sessions via SessionStart hooks
- **TUI Dashboard** — Interactive terminal UI (ink/React) for monitoring system health, recent memories, team activity
- **Setup Wizard** — Interactive initialization for new deployments (issue #46)
- **MCP Server** — Model Context Protocol server for AI agent integration
- **REST API** — Full HTTP API for all operations (currently only partial)

### Observability

- **Full OTel Integration** — Export traces to Jaeger, metrics to Prometheus, logs to Loki/ELK
- **Continuous Aggregates** — TimescaleDB materialized views for dashboards (daily stats, hourly latency)
- **Alerting** — Define SLOs and alert on breaches (latency, error rate, ingestion lag)

### Ecosystem & Connectors

- **Additional Connectors** — Cursor, Windsurf, VS Code, Aider, Cline, GitHub Copilot, Codex, Gemini CLI, Devin
- **Connector SDK** — Documentation and example templates for building custom connectors
- **Webhook Support** — Generic webhook connector for any tool that can POST JSON

---

## Architectural Principles

To keep the codebase maintainable and extensible:

1. **Dependency Inversion** — Depend on abstractions (Store, EmbeddingProvider, LLMProvider), not concretions. Use constructor injection.
2. **Single Responsibility** — Each class/module does one thing. Split God objects (e.g., PostgresStore → repositories).
3. **Configuration Over Hardcoding** — All endpoints, timeouts, limits must be configurable via env/config. No localhost in production.
4. **Explicit Over Implicit** — Make dependencies, side effects, and error conditions obvious.
5. **Testability** — Design for unit testing. Mock interfaces, avoid static singletons.
6. **Data Integrity** — Preserve raw events. Never discard fields in mapping. Track lineage (source_event_id).
7. **Observability** — Instrument all critical paths with spans, metrics, structured logs.
8. **Security First** — Enforce permissions at every layer. Validate all inputs.
9. **Extensibility** — Use polymorphism for variable behaviors (retrievers, synthesizers, classifiers). Open/Closed Principle.
10. **Performance Awareness** — Avoid N+1 queries, batch operations, use indexes, cache judiciously.

---

## Current Implementation Snapshot

**Overall completeness:** ~60%  
**Last major update:** 2026-04-04 — Completed permission enforcement across all core resources; added custom provider for remote LLM/embeddings; made hooks configurable.

**Recent commits:**
- `feat: complete permission enforcement + RAG remote endpoint support` (810d417)
- Includes: multi-tenant security, custom providers, LlamaIndex buildIndex, configurable hooks, extensive docs

**Key files:**
- `src/store/postgres/store.ts` — Main store implementation (~1300 lines)
- `src/store/interface.ts` — Store abstraction (82 lines)
- `src/memory/engine.ts` — Memory enrichment orchestration
- `src/memory/rag.ts` — RAG engine with multi-provider LLM
- `src/memory/embed-factory.ts` — Provider factory for embeddings
- `src/commands/*` — CLI command implementations
- `IMPLEMENTATION_STATUS.md` — Detailed per-component status
- `docs/decisions/COMPREHENSIVE_REVIEW_2026-04-03.md` — Strategic analysis

---

## Next Steps (Prioritized)

1. **Validate Connectors** — Test Claude Code hooks on real installation (issue #12)
2. **Complete Telemetry** — Implement real OTLP exporter or ensure pino logs are captured (issue #22)
3. **Add Validation** — Introduce zod schemas for config and event validation (new issue)
4. **Error Resilience** — Retry + circuit breakers for external calls (issue #44)
5. **Benchmark & Optimize** — Measure latency, add missing indexes, tune queries (issue #45)
6. **PII Detection** — Implement redaction service (issue #47)
7. **Define MVP Scope** — Formalize MVP feature set and acceptance criteria (issue #42)
8. **Implement Tests** — Start with critical paths (issue #34)
9. **Switch RAG to LlamaIndex** — Use persistent vector store (issue #18)
10. **Context Injection** — Implement semantic injection (future)

---

*This document is the single source of truth for what we're building and why. Update it when priorities change.*
