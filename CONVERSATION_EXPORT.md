# 🐙 Nautalis — Full Conversation Export

> **Date:** April 3, 2026
> **User:** cbwinslow
> **Project:** Nautalis — Universal AI Agent Memory & Orchestration Platform
> **Repository:** github.com/cbwinslow/nautalis
> **Branch:** develop (pushed to origin)

---

## Table of Contents

1. [Initial Idea — TUI Shell Extension](#1-initial-idea--tui-shell-extension)
2. [Pivot — AI Agent Orchestrator](#2-pivot--ai-agent-orchestrator)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Database Evolution](#4-database-evolution)
5. [Key User Requirements](#5-key-user-requirements)
6. [What Was Built](#6-what-was-built)
7. [What's Pending](#7-whats-pending)
8. [Important Files and Locations](#8-important-files-and-locations)
9. [GitHub Setup](#9-github-setup)
10. [Next Steps](#10-next-steps)

---

## 1. Initial Idea — TUI Shell Extension

The user started wanting to build a **terminal window / TUI that extends shell/terminal windows** with side panes similar to OpenCode. They wanted:

- Modifiable/extensible panes for tools
- Search/find routine/results pane with fuzzy find and history
- File browser and visualizer with FS stats
- AI agent hosted in a pane (like Kilo Code) that can see everything in the terminal
- Beautiful UI
- Go + Bubble Tea ecosystem

**My recommendation:** Bubble Tea v2 (proven by TUIOS, 41k stars). I researched TUIOS extensively — it's a terminal multiplexer with BSP tiling, workspaces, vim-modal interface, built on Bubble Tea v2 + Lipgloss v2. 2.6k stars, 392 commits.

**User's response:** "yea im not sure now. im not even sure what i want to do."

---

## 2. Pivot — AI Agent Orchestrator

The user then described a fundamentally different idea:

> "what about a ai agent that has rag inference using the bash_history and will actually gather logs, settings, info, conversations from all ai agent tools and aggregate everything. kind of like a super agent that will orchestrate and organize all interactions with ai agents."

> "some people use claude and some people use opencode and i dont know if there are people like me that use all of the free models until one runs out of tokens and then just goes to the next one."

> "it would be nice to have some system that organizes and centralizes all ai agent conversations, results, memories, settings, api keys, projects, repos, scripts, skills, workflows, commands, extensions, etc.... centralizing all of the info/data and is able to answer questions about it and use all of that information and organize it so it could be useful."

> "one major advantage is universal memory shared across instances, conversations, ai agents, etc... so like a system that works behind the scenes by gathering, aggregating and organizing and storing and recalling data and conversations to help the user have a global perspective on all of their work and their ai agents will know everything that they have been working on all the time."

> "we can design hooks and events so this agent can force other agents to send information their way or to keep them informed and stuff like that. essentially we would be designing a bottleneck or aggregator for all things ai agent and provide tools to import memories and settings and keys and conversations and data and automate the organization and application of that information."

> "this could be especially useful for teams that are working together on the same project we could setup these orchestrator agent to aggregate team data together so your agent would know what your teammate is doing and could stop you from duplicating efforts or could help you synergize work and could guide you and save you conversations/emails/meetings to get on the same page with teammates. could provide you with updates on what your teammate is doing"

**My assessment:** This is a fundamentally different — and much more compelling — idea. The TUI shell extension is 70% covered by TUIOS already. The AI orchestrator is completely unique. Nobody is building cross-agent memory and orchestration.

---

## 3. Architecture Decisions

### 3.1 Language: Go → TypeScript
- **Initially:** Go was the plan
- **User changed:** "wait... im sorry.... i want to use typescript for this not goland. we can use golang for the interface but i want typescript or python to be the primary language for this. and we need to use pnpm, bun or npm for our package management"
- **Decision:** TypeScript + Bun + commander.js + ink (React TUI)
- **Why:** Faster development, better AI tool integration, native web support, Bun is extremely fast

### 3.2 Database: SQLite → PostgreSQL Only
- **Initially:** SQLite as default, PostgreSQL as team option
- **User changed:** "should we consider just dropping sqlite from our coverage in favor of supabase or postgre? i plan to accumulate a ton of data regardless of how many people use it. we want to gather stuff from everywhere and create a bottleneck of logs, errors, warnings, results, network traffic, conversations, ETL, etc..."
- **User continued:** "and we can plan our user management out of there and the teams and data sharing and permissions. sqlite cant handle that. postgre links into the system better. because of this and the portability issues.... what about supabase? or at least pgsql."
- **User continued:** "does supabase still have good development and commits? is there another db project out there that we could use like botldb or something that's also free?"
- **User continued:** "you understand what i am after right? is it worth integrating a time series extension in pgsql or supabase too for data over time?"
- **User continued:** "lets also create a feature for a universal knowledge base that ai agents can pull from. all of these features need to have a security protocol wrapped over them managed through a database so a manager can assign permissions to users. lets setup a permission structure or we can use the internal pgsql permission structure as well."
- **Decision:** Drop SQLite entirely. PostgreSQL + Supabase + TimescaleDB only.
- **Why:** Data volume, multi-user, multi-team, permissions, time-series analytics, RLS security

### 3.3 Memory Backend: Mem0/Letta → Custom
- **Initially:** Considered using Mem0 or Letta as memory backend
- **Decision:** Custom enrichment layer on top of PostgreSQL with pgvector
- **Why:** Mem0/Letta are designed for single-agent memory, not cross-agent orchestration. Our use case needs rich structured metadata that their generic models don't support.

### 3.4 RAG: LlamaIndex.TS
- **Decision:** LlamaIndex.TS for retrieval-augmented generation
- **Why:** Leading TypeScript framework for context engineering. Native Bun support. Handles indexing, retrieval, synthesis, and agent workflows.

### 3.5 Observability: OpenTelemetry
- **User requested:** "lets use opentelemetry to create a sophisticated log and capture system that feeds into a pipeline that can be used to diagnose and benchmark issues"
- **Decision:** Full OpenTelemetry SDK with traces, metrics, logs, and custom benchmarking utility
- **Enterprise stack:** OTel Collector → Jaeger (traces) + Grafana (metrics)

### 3.6 Time-Series: TimescaleDB
- **Decision:** TimescaleDB as PostgreSQL extension
- **Why:** User accumulates massive data over time. Needs automatic compression, retention, and continuous aggregates for dashboards.
- **Hypertables:** events, telemetry, audit_log
- **Continuous aggregates:** daily event stats, daily memory stats, hourly latency percentiles

### 3.7 Name: "nautalis"
- **User requested:** "whats a snappy word that means orchestrator or like an octopus since our agent will have tentacles wrapping around all parts of the operation and its a smart system. nautalis? or something like openclaw. this is less important we can change later. i like a purple octopus being the mascot or a purple squid."
- **Decision:** "nautalis" (from nautilus — ancient cephalopod)
- **Mascot:** Purple octopus/squid

---

## 4. Database Evolution

### Final Schema (PostgreSQL Only)

**17 Core Tables:**
1. `users` — User profiles, linked to Supabase auth.users
2. `teams` — Team/org units with settings and limits
3. `team_members` — Membership with role hierarchy
4. `role_permissions` — Default permission matrix (seeded)
5. `team_permissions` — Custom permission overrides
6. `resource_shares` — Cross-team resource sharing
7. `projects` — Logical project groupings
8. `agents` — AI tool instances
9. `sessions` — AI agent conversation sessions
10. `events` — All AI agent events (TimescaleDB hypertable)
11. `memories` — Enriched memories with classification
12. `memory_embeddings` — pgvector embeddings (384-dim)
13. `knowledge_base` — Curated knowledge entries with versioning
14. `knowledge_base_embeddings` — pgvector for KB
15. `knowledge_base_history` — Edit history
16. `audit_log` — All audit events (TimescaleDB hypertable)
17. `telemetry` — OpenTelemetry data (TimescaleDB hypertable)

**3 TimescaleDB Hypertables:**
- `events` — 7-day chunks, compress 30d, retain 365d
- `audit_log` — 7-day chunks, compress 30d, retain 730d
- `telemetry` — 1-day chunks, compress 7d, retain 90d

**3 Continuous Aggregates:**
- `events_daily_stats` — Daily counts, sessions, errors
- `memories_daily_stats` — Daily growth, importance, staleness
- `telemetry_hourly_latency` — p50/p95/p99 percentiles

**Key Helper Functions:**
- `has_team_role()`, `get_user_teams()`, `has_permission()`, `can()`
- `find_similar_memories()` — Vector search
- `search_knowledge_base()` — KB search (vector + FTS)
- `get_team_dashboard()` — JSONB dashboard stats
- `auto_stale_memories()`, `track_memory_access()`

---

## 5. Key User Requirements

### From the User's Exact Words:

1. **"Universal memory shared across instances, conversations, ai agents"** — Every AI tool's data aggregated into one place
2. **"Bottleneck or aggregator for all things AI agent"** — Central collection point for all AI activity
3. **"Tools to import memories and settings and keys and conversations and data"** — Import from existing tools
4. **"Automate the organization and application of that information"** — Auto-classify, auto-link, auto-surface
5. **"For teams that are working together on the same project"** — Multi-user from the start
6. **"Your agent would know what your teammate is doing"** — Cross-user awareness
7. **"Stop you from duplicating efforts"** — Conflict detection
8. **"Save you conversations/emails/meetings to get on the same page"** — Automatic context sharing
9. **"Provide you with updates on what your teammate is doing"** — Activity feeds
10. **"Gather stuff from everywhere"** — Logs, errors, warnings, results, network traffic, conversations, ETL
11. **"Accumulate a ton of data"** — Time-series with compression and retention
12. **"Manager can assign permissions to users"** — RBAC with database-level enforcement
13. **"Security protocol wrapped over them managed through a database"** — RLS policies
14. **"Universal knowledge base that ai agents can pull from"** — Curated, versioned, searchable
15. **"Sophisticated log and capture system"** — OpenTelemetry for diagnosis and benchmarking

### Design Philosophy (User's Words):
> "extendable, flexible, smart, adaptable, easy to use, helpful, AI agent based"

### Cost Constraint:
User wants everything to be **free**. No paid APIs, no subscriptions. Ollama for local embeddings, PostgreSQL for storage, all open-source.

### User Context:
- Switches between Windows and Linux environments
- Values speed — "this is taking forever" feedback means batch operations and commit frequently
- Uses multiple AI agents (Claude Code, Kilo Code, etc.) and bounces between free tiers
- Wants team features from the start
- Purple octopus/squid mascot is important

---

## 6. What Was Built

### Files Created: 146 total
- **Source code:** ~50 TypeScript files
- **Migrations:** 13 SQL files
- **Documentation:** 24 files (knowledge base, guides, ADRs, API specs)
- **GitHub:** 8 workflows, 4 issue templates, dependabot, labeler, CODEOWNERS
- **Docker:** 3 compose files + Dockerfile
- **Hooks:** 3 Claude Code hook scripts + installer

### Key Components:

#### Store Layer
- `PostgresStore` — Full CRUD for all 17 tables
- `SupabaseStore` — Extends Postgres with GoTrue auth + Realtime
- `PermissionManager` — Role-based permission checks with 60s cache
- `KnowledgeBaseEngine` — Vector + FTS search for knowledge base

#### Memory Engine
- `MemoryClassifier` — Auto-classifies events into memory types, extracts topics, scores importance
- `DecisionExtractor` — Pattern-based decision extraction (TODO: LLM-based)
- `EmbeddingService` — Ollama embeddings (384-dim)
- `RAGEngine` — LlamaIndex.TS with VectorStoreIndex

#### Connectors
- `ClaudeCodeConnector` — Hooks + transcript parsing
- `KiloCodeConnector` — Session file parsing
- `FileSystemConnector` — Generic, configurable, custom parser support

#### Telemetry
- Full OpenTelemetry SDK (traces, metrics, logs)
- `benchmarkOperation()` utility
- Telemetry middleware for all operations

#### CLI (14 commands)
- `init`, `daemon`, `ingest`, `search`, `ask`, `timeline`
- `hooks`, `memory`, `inject`, `status`, `connectors`, `setup`
- `team` (create, list, info, invite, role, remove, members)
- `perm` (check, grant, revoke, matrix, share)
- `kb` (create, search, list, get, delete)

#### TUI (ink React components)
- `StatusBar`, `MemoryList`, `Timeline`, `SetupWizard`

#### GitHub
- 18 open issues (properly labeled and linked)
- 8 CI/CD workflows
- Dependabot with auto-merge
- Auto-labeler for PRs
- 15 custom labels

---

## 7. What's Pending

### High Priority
1. **Wire team/perm/kb commands** — Files exist but not registered in command hub
2. **LLM-based decision extraction** — Currently regex-based, needs LLM integration
3. **Context injection for SessionStart** — Build context, format for agents
4. **Real-time event streaming** — Watch mode for connectors (chokidar)
5. **Supabase Realtime subscriptions** — Team activity broadcasting
6. **Migration runner script** — Automated migration execution
7. **Full test suite** — Unit + integration tests (80%+ coverage target)

### Medium Priority
8. **Additional connectors** — Cursor, Windsurf, VS Code, Aider, Cline, Codex, Gemini CLI, Devin
9. **TUI dashboard** — Main view with pane layout, keyboard navigation
10. **Docker health checks** — All services need proper health checks
11. **Update existing commands for team context** — All commands need `--team` flag and permission checks

### Low Priority
12. **Memory relationship graph builder** — Auto-link related memories
13. **Contradiction detection** — Flag conflicting memories
14. **Temporal decay management** — Auto-stale based on access patterns
15. **Grafana dashboards** — Pre-built dashboards for metrics
16. **Edge functions for Supabase** — Custom webhooks

---

## 8. Important Files and Locations

### Core Architecture
```
nautalis/
├── src/cli.ts                          # Entry point
├── src/commands/register.ts            # Command registration hub (NEEDS team/perm/kb added)
├── src/store/interface.ts              # Store interface (definitive contract)
├── src/store/factory.ts                # Driver factory (postgres/supabase)
├── src/store/postgres/store.ts         # PostgreSQL implementation
├── src/store/postgres/permissions.ts   # Permission manager
├── src/store/postgres/knowledge-base.ts # KB engine
├── src/store/supabase/store.ts         # Supabase extension
├── src/connectors/registry.ts          # Connector registry
├── src/memory/engine.ts                # Memory orchestration
├── src/memory/rag.ts                   # LlamaIndex RAG
├── src/telemetry/provider.ts           # OpenTelemetry SDK
├── src/telemetry/benchmark.ts          # Benchmarking utility
├── src/config/defaults.ts              # Default config (PostgreSQL)
└── src/types/                          # All TypeScript types
```

### Migrations (in order)
```
migrations/postgres/
├── core/
│   ├── 001_extensions.sql              # uuid-ossp, pgvector, timescaledb, pg_trgm
│   ├── 002_enums.sql                   # 9 enum types
│   ├── 003_users_teams.sql             # users, teams, team_members
│   ├── 004_permissions.sql             # role_permissions, team_permissions, resource_shares + seed
│   ├── 005_projects_agents.sql         # projects, agents, sessions
│   ├── 006_events_memories.sql         # events, memories, memory_embeddings + indexes
│   ├── 007_knowledge_base.sql          # knowledge_base, embeddings, history
│   └── 008_audit_log.sql               # audit_log
├── timescaledb/
│   ├── 001_hypertables.sql             # events + audit_log hypertables
│   ├── 002_telemetry_hypertable.sql    # telemetry hypertable
│   └── 003_continuous_aggregates.sql   # daily stats, hourly latency
└── rls/
    ├── 001_rls_policies.sql            # RLS on all tables + helper functions
    └── 002_functions.sql               # can(), find_similar_memories, search_knowledge_base, etc.
```

### Documentation
```
docs/
├── README.md                           # Documentation index
├── knowledge-base/                     # 12 articles
├── guides/                             # 8 articles
├── decisions/                          # 5 ADRs
└── api/                                # OpenAPI + MCP specs

AGENTS.md                               # AI agent instructions (530 lines)
SRS.md                                  # Software Requirements Specification
CONTEXT.md                              # Project context and background
RULES.md                                # Project rules and conventions
PROJECT_SUMMARY.md                      # High-level project summary
CONVERSATION_EXPORT.md                  # This file
```

### GitHub
```
.github/
├── workflows/
│   ├── ci.yml                          # Type check, lint, test, build, Docker
│   ├── release.yml                     # GitHub release, npm publish, Docker multi-arch
│   ├── docs.yml                        # Markdown validation, GitHub Pages
│   ├── stale.yml                       # Auto-stale issues/PRs
│   ├── labeler.yml                     # Auto-label PRs by file path
│   ├── dependabot-auto-merge.yml       # Auto-approve/merge deps
│   ├── pr-lint.yml                     # Conventional commit PR titles
│   └── migration-check.yml             # Validate SQL migrations
├── ISSUE_TEMPLATE/                     # 4 templates
├── dependabot.yml                      # Dependency automation
├── labeler.yml                         # Auto-label config
├── CODEOWNERS
└── PULL_REQUEST_TEMPLATE.md
```

---

## 9. GitHub Setup

### Repository: github.com/cbwinslow/nautalis
- **Branches:** `main` (production), `develop` (integration)
- **Current:** `develop` branch, pushed to `origin/develop`
- **Tags:** `v0.1.0` (initial scaffold)

### Open Issues (18)
| # | Title | Labels |
|---|---|---|
| #1 | Migrate store layer from SQLite to PostgreSQL | enhancement |
| #3 | Implement RLS policies for all tables | security, database, permissions |
| #5 | Implement team management CLI commands | cli, teams |
| #7 | Implement permission management CLI commands | cli, permissions |
| #9 | Implement knowledge base CLI commands | cli, knowledge-base |
| #10 | Configure TimescaleDB hypertables | database, timeseries |
| #12 | Implement Claude Code connector | connectors |
| #14 | Implement Kilo Code connector | connectors |
| #16 | Implement FileSystem connector | connectors |
| #18 | Integrate LlamaIndex.TS RAG | rag |
| #20 | Smart context injection | connectors, rag |
| #22 | OpenTelemetry pipeline | observability |
| #24 | Docker deployment | docker |
| #25 | Interactive TUI with ink | tui |
| #27 | Additional connectors (9 agents) | connectors |
| #29 | Supabase integration | database, teams |
| #30 | Memory enrichment pipeline | rag |
| #32 | Update commands for team context | cli, permissions, teams |
| #34 | Comprehensive test suite | test |

### Labels (15)
`security`, `database`, `cli`, `connectors`, `rag`, `observability`, `docker`, `documentation`, `ci-cd`, `knowledge-base`, `permissions`, `teams`, `timeseries`, `tui`, `test`

---

## 10. Next Steps

### When You Resume on Windows:

1. **Clone the repo:**
   ```bash
   git clone git@github.com:cbwinslow/nautalis.git
   cd nautalis
   git checkout develop
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Set up PostgreSQL + TimescaleDB:**
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

4. **Run migrations:**
   ```bash
   # Manual:
   for f in migrations/postgres/core/*.sql; do
     psql -f "$f"
   done
   for f in migrations/postgres/timescaledb/*.sql; do
     psql -f "$f" || true
   done
   for f in migrations/postgres/rls/*.sql; do
     psql -f "$f"
   done
   ```

5. **First things to implement:**
   - Wire team/perm/kb commands into `src/commands/register.ts`
   - Test the full pipeline: `nautalis init` → `nautalis hooks install claude` → `nautalis ingest` → `nautalis search "test"`
   - Build the LLM-based decision extractor
   - Add the remaining connectors

### Priority Order:
1. Wire commands → Test end-to-end pipeline
2. LLM decision extraction → Better memory quality
3. Context injection → Immediate user value
4. Additional connectors → Broader coverage
5. Test suite → Confidence for future changes
6. TUI dashboard → Beautiful interface

---

## Final Notes

- **Everything is committed and pushed** to `origin/develop`
- **AGENTS.md** has the definitive project reference for AI agents
- **This file** has the full conversation context and decision trail
- **The user switches between Windows and Linux** — keep cross-platform compatibility in mind
- **Speed matters** — batch operations, commit frequently, don't ask unnecessary questions
- **Everything must be free** — no paid APIs, no subscriptions
- **Purple octopus/squid mascot** — important to the user
- **Team-first approach** — not personal, not enterprise, team from the start
- **Data bottleneck** — the user wants to accumulate massive amounts of data from all AI agents

---

*Export created: April 3, 2026*
*Conversation span: ~3 hours of active development*
*Total messages: ~60 exchanges*
*Files created: 146*
*Lines of code: ~16,000+*
