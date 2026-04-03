# CLI Reference

Nautalis provides a comprehensive command-line interface built with commander.js.

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--config <path>` | `-c` | Path to configuration file |
| `--data-dir <path>` | `-d` | Override data directory |
| `--log-level <level>` | `-l` | Set log level (debug, info, warn, error) |
| `--quiet` | `-q` | Suppress all output except errors |
| `--json` | `-j` | Output in JSON format |
| `--verbose` | `-v` | Enable verbose output |
| `--help` | `-h` | Show help for command |
| `--version` | `-V` | Show version number |

## Commands

### `nautalis init`

Initialize a new Nautalis installation.

```bash
nautalis init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <backend>` | Storage backend (sqlite, postgresql) | `sqlite` |
| `--embeddings <provider>` | Embedding provider (ollama, openai) | `ollama` |
| `--no-telemetry` | Disable OpenTelemetry | `false` |
| `--force` | Overwrite existing configuration | `false` |

**Example:**
```bash
nautalis init --storage postgresql --embeddings openai
```

**Output:**
```
✓ Nautalis initialized
  Storage:  SQLite (~/.nautalis/nautalis.db)
  Embeddings: Ollama (nomic-embed-text)
  Telemetry: Enabled (console)
  Config:   ~/.nautalis/nautalis.toml
```

### `nautalis ingest`

Ingest events from connectors into memory.

```bash
nautalis ingest [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--connector <id>` | Specific connector to ingest from | all enabled |
| `--since <duration>` | Ingest events since duration (e.g., 1h, 2d, 7d) | all |
| `--until <duration>` | Ingest events until duration | now |
| `--project <path>` | Project path to scan | current directory |
| `--batch-size <n>` | Number of events per batch | 100 |
| `--dry-run` | Show what would be ingested without storing | `false` |

**Example:**
```bash
nautalis ingest --connector claude-code --since 2d --batch-size 50
```

**Output:**
```
Ingesting from claude-code (since 2d)...
  ✓ 47 events processed
  ✓ 32 memories created
  ✓ 15 events skipped (duplicates)
  Duration: 2.3s
```

### `nautalis search`

Search memories using semantic or keyword search.

```bash
nautalis search <query> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--type <type>` | Filter by memory type | all |
| `--agent <id>` | Filter by agent ID | all |
| `--since <duration>` | Filter by time range | all |
| `--limit <n>` | Maximum results | 10 |
| `--min-score <n>` | Minimum relevance score | 0.0 |
| `--full` | Show full memory content | false |

**Example:**
```bash
nautalis search "database migration" --type decision --limit 5 --full
```

**Output:**
```
Search results for "database migration" (5 found):

1. [decision] Chose PostgreSQL for team deployment (score: 0.94)
   Agent: claude-code | 2026-03-15 | Importance: 0.85
   We decided to use PostgreSQL because SQLite doesn't support
   concurrent writes well. The connection pooling setup uses pgBouncer.

2. [procedural] Migration command reference (score: 0.87)
   Agent: kilo-code | 2026-03-16 | Importance: 0.70
   Run migrations with: bun run migrate --env production
```

### `nautalis ask`

Ask questions about your memory/knowledge base using RAG.

```bash
nautalis ask <question> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--sources` | Show source memories for the answer | `false` |
| `--max-memories <n>` | Max memories to use for context | 10 |
| `--agent <id>` | Scope question to specific agent | all |

**Example:**
```bash
nautalis ask "what did I decide about authentication?" --sources
```

**Output:**
```
Based on your memory, you made the following decisions about authentication:

1. You chose JWT tokens over session-based auth (March 15)
   Reason: Stateless, works well with microservices

2. You decided to use Auth0 for OAuth integration (March 18)
   Reason: Managed service, reduces maintenance burden

3. You established a pattern of role-based access control (March 20)
   Roles: admin, editor, viewer

Source memories: 3 (showing top 3 of 5 retrieved)
```

### `nautalis timeline`

View a chronological timeline of memories.

```bash
nautalis timeline [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--since <duration>` | Start of timeline | 24h |
| `--until <duration>` | End of timeline | now |
| `--agent <id>` | Filter by agent | all |
| `--type <type>` | Filter by memory type | all |
| `--group` | Group by session | false |
| `--compact` | Compact output | false |

**Example:**
```bash
nautalis timeline --since 2d --agent claude-code --group
```

**Output:**
```
Timeline (last 2 days, claude-code):

2026-04-01
  09:15  [decision] Adopt new error handling pattern
  09:32  [episodic] Refactored user-service.ts (23 files)
  10:45  [lesson] Avoid circular imports in utils/

2026-04-02
  14:00  [decision] Switch to connection pooling
  14:15  [procedural] pgBouncer configuration steps
  15:30  [semantic] Database schema v3 overview
```

### `nautalis status`

Show Nautalis system status.

```bash
nautalis status
```

**Output:**
```
Nautalis Status: Healthy

Storage:    SQLite (42.3 MB, 1,247 memories)
Embeddings: Ollama (nomic-embed-text, connected)
Connectors: 2 active, 1 inactive
  ✓ claude-code (v1.0.0, last seen 5m ago)
  ✓ kilo-code (v1.0.0, watching)
  ✗ filesystem (disabled)
Telemetry:  Console exporter, 1,892 spans today
Memory:     90d TTL, 0.3 importance threshold
```

### `nautalis watch`

Start real-time event watching from connectors.

```bash
nautalis watch [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--connector <id>` | Specific connector to watch | all enabled |
| `--project <path>` | Project path | current directory |

**Example:**
```bash
nautalis watch --connector kilo-code
```

**Output:**
```
Watching kilo-code (Ctrl+C to stop)...
  [14:32:01] File edit: src/auth/middleware.ts (+12 lines)
  [14:32:01] Memory created: [episodic] Added rate limiting to auth middleware
  [14:33:15] Tool call: ReadFile (src/auth/types.ts)
  [14:33:16] Memory created: [semantic] Auth type definitions overview
```

### `nautalis context`

Generate context package for a new session.

```bash
nautalis context [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--query <text>` | Session description for relevance scoring | — |
| `--agent <id>` | Target agent for context | current |
| `--project <path>` | Project context | current directory |
| `--max-tokens <n>` | Maximum context tokens | 4096 |
| `--format <format>` | Output format (text, json, markdown) | `text` |

**Example:**
```bash
nautalis context --query "implementing user registration with email verification" --format json
```

### `nautalis memory`

Manage individual memories.

```bash
nautalis memory <command> [options]
```

| Subcommand | Description |
|------------|-------------|
| `list` | List memories with filters |
| `get <id>` | Show a specific memory |
| `delete <id>` | Delete a memory |
| `update <id>` | Update memory content or metadata |
| `link <id1> <id2>` | Create relationship between memories |
| `export` | Export memories to file |
| `import` | Import memories from file |

**Example:**
```bash
nautalis memory list --type decision --since 7d --limit 20
nautalis memory get abc123-def456
nautalis memory delete abc123-def456 --force
```

### `nautalis connectors`

Manage connector configuration.

```bash
nautalis connectors <command>
```

| Subcommand | Description |
|------------|-------------|
| `list` | List all available connectors |
| `status` | Show connector health status |
| `enable <id>` | Enable a connector |
| `disable <id>` | Disable a connector |
| `config <id>` | Show connector configuration |

**Example:**
```bash
nautalis connectors list
nautalis connectors status
nautalis connectors enable cursor
```

### `nautalis telemetry`

Manage telemetry data.

```bash
nautalis telemetry <command>
```

| Subcommand | Description |
|------------|-------------|
| `status` | Show telemetry status |
| `traces` | View recent traces |
| `metrics` | View current metrics |
| `export` | Export telemetry data |

### `nautalis migrate`

Run database migrations.

```bash
nautalis migrate [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Show migrations without executing | `false` |
| `--target <version>` | Migrate to specific version | latest |
| `--rollback` | Rollback last migration | `false` |

### `nautalis server`

Start the REST API and/or MCP server.

```bash
nautalis server [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--api` | Start REST API server | `false` |
| `--mcp` | Start MCP server | `false` |
| `--port <n>` | API server port | 3000 |
| `--mcp-port <n>` | MCP server port | 3456 |

**Example:**
```bash
nautalis server --api --mcp
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Configuration error |
| `3` | Storage error |
| `4` | Connector error |
| `5` | Embedding error |
| `64` | Invalid command or argument |
| `65` | Missing required argument |
| `70` | Internal error |
