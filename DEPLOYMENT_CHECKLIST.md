# Nautalis MVP Deployment Checklist

Use this checklist to verify a successful Nautalis deployment for single-team MVP.

**Target Version:** v0.1.0  
**Last Updated:** 2026-04-08

---

## Pre-Deployment

- [ ] PostgreSQL 16+ installed and running
- [ ] Extensions installed: `pgvector`, `timescaledb`, `pg_trgm`, `uuid-ossp`, `btree_gin`
- [ ] Database `nautalis` created with owner having sufficient privileges
- [ ] Environment variable `DATABASE_URL` set correctly
- [ ] (Optional) Ollama running for local embeddings/LLM, or configured alternative provider

---

## Installation

- [ ] `bun install` completes without errors
- [ ] `bun run build` produces `dist/cli.js`
- [ ] `bun run cli.ts init` runs migrations successfully
  - [ ] Core migrations applied (001-008)
  - [ ] TimescaleDB migrations applied (hypertables, aggregates)
  - [ ] RLS policies enabled
- [ ] `nautalis setup` wizard works (optional, but recommended for first-time users)

---

## Basic Operations

- [ ] `nautalis status` reports healthy system (store initialized, no errors)
- [ ] `nautalis team create "Test Team"` succeeds
- [ ] User can join team and be assigned role
- [ ] `nautalis connectors list` shows available connectors (claude_code, kilo_code, cursor, filesystem)

---

## Ingestion

- [ ] Create a test agent via `nautalis ingest` or directly call store.upsertAgent
- [ ] Create a test session via store.createSession
- [ ] Prepare a sample event JSON (tool_use, file_edit, conversation) with required fields
- [ ] Call store.insertEvent and verify it creates a memory (if tool_use)
- [ ] Verify `memory_embeddings` row exists for the memory (if embedding service available)

---

## Search & RAG

- [ ] `nautalis search "test query"` returns results (or direct API call)
- [ ] `nautalis ask "question?"` returns an answer (requires LLM provider configured)
- [ ] Hybrid search uses both vector and FTS (verify by EXPLAIN or metric)

---

## Permissions & Security

- [ ] User with `viewer` role can only read, not write
- [ ] `nautalis permissions check` verifies allowed/denied actions
- [ ] `audit_log` table populated for memory/knowledge base modifications
- [ ] Rate limiting enabled on daemon (default 100 req/min per IP)

---

## Observability

- [ ] If `OTEL_EXPORTER_OTLP_ENDPOINT` set, traces appear in Jaeger
- [ ] If not set, metrics inserted into `telemetry` table
- [ ] `nautalis status` shows observability state (enabled/disabled)
- [ ] Connector health reported via `nautalis connectors health`

---

## Docker (Optional)

- [ ] `docker compose -f docker/docker-compose.yml up -d` starts all services
- [ ] Nautalis container accessible at http://localhost:3002
- [ ] Jaeger at http://localhost:16686, Grafana at http://localhost:4000
- [ ] `docker exec <nautalis-container> bun run dist/cli.js status` works

---

## Team Features

- [ ] Create multiple teams; user can belong to multiple teams
- [ ] Cross-team resource sharing works (if configured)
- [ ] Knowledge base entries respect visibility levels (public/team/project/private)
- [ ] Resource Shares table properly restricts access

---

## Known Gaps (Not Blocking MVP)

- Real-world Claude Code/Kilo Code hooks validation (manual testing on actual installations)
- TUI/dashboard components (stubbed, not integrated)
- Supabase Realtime subscriptions (not required for MVP)
- MCP server (not required; REST API is used)

---

## Troubleshooting

### Database connection errors
- Verify `DATABASE_URL` format and credentials
- Ensure PostgreSQL is accepting connections (pg_hba.conf)
- Check database existence and user privileges

### Embedding generation slow/failing
- Ensure Ollama is running on configured URL (`http://localhost:11434` by default)
- Check firewall/network if using remote provider
- E2E test uses dummy embedding in CI; real deployments need real provider

### Permission errors
- Confirm RLS policies are enabled: `ALTER TABLE memories ENABLE ROW LEVEL SECURITY;`
- Check user's role in `team_members` table
- Use `has_permission()` helper in store methods

### Migration failures
- Ensure all extensions are installed in target database
- Run `CREATE EXTENSION IF NOT EXISTS pgvector;` etc.
- TimescaleDB requires `shared_preload_libraries = 'timescaledb'` in postgresql.conf

---

## Success Criteria

All essential checks pass, and:
- At least one AI agent session has been successfully ingested and enriched
- Semantic search returns relevant memories
- RAG answer generation works with configured LLM
- Multi-user permissions are enforced
- Observability data is captured (traces or DB metrics)

If these are met, the MVP is considered **deployed and operational**.
