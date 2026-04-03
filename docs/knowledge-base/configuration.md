# Configuration Reference

Nautalis is configured through a layered system with multiple sources.

## Configuration Priority

Configuration is resolved in this order (highest priority wins):

1. **CLI flags** — Command-line arguments
2. **Environment variables** — `NAUTALIS_*` prefixed vars
3. **Config file** — `nautalis.toml`, `nautalis.json`, or `nautalis.yaml`
4. **Defaults** — Built-in default values

```
Defaults ← Config File ← Environment Variables ← CLI Flags
```

## Config File Formats

Nautalis supports three config file formats, auto-detected by extension:

### TOML (Recommended)

```toml
# nautalis.toml
[general]
dataDir = "~/.nautalis"
logLevel = "info"
telemetryEnabled = true

[storage]
backend = "sqlite"
path = "~/.nautalis/nautalis.db"

[embeddings]
provider = "ollama"
model = "nomic-embed-text"
baseUrl = "http://localhost:11434"
dimensions = 768

[connectors.claude-code]
enabled = true
sessionPath = "~/.claude/sessions"
watchMode = false

[connectors.kilo-code]
enabled = true
projectPath = "./"
watchMode = true

[connectors.filesystem]
enabled = false
watchPaths = ["./src", "./tests"]

[telemetry]
enabled = true
exporter = "console"
serviceName = "nautalis"
serviceVersion = "1.0.0"

[memory]
defaultTTL = "90d"
importanceThreshold = 0.3
maxContextMemories = 10

[orchestration]
conflictDetection = true
contextInjection = true
maxContextSize = 4096
```

### JSON

```json
{
  "general": {
    "dataDir": "~/.nautalis",
    "logLevel": "info",
    "telemetryEnabled": true
  },
  "storage": {
    "backend": "sqlite",
    "path": "~/.nautalis/nautalis.db"
  },
  "embeddings": {
    "provider": "ollama",
    "model": "nomic-embed-text",
    "baseUrl": "http://localhost:11434",
    "dimensions": 768
  },
  "connectors": {
    "claude-code": { "enabled": true, "sessionPath": "~/.claude/sessions" },
    "kilo-code": { "enabled": true, "projectPath": "./", "watchMode": true }
  }
}
```

### YAML

```yaml
general:
  dataDir: ~/.nautalis
  logLevel: info
  telemetryEnabled: true

storage:
  backend: sqlite
  path: ~/.nautalis/nautalis.db

embeddings:
  provider: ollama
  model: nomic-embed-text
  baseUrl: http://localhost:11434
  dimensions: 768
```

## All Configuration Options

### General

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `general.dataDir` | string | `~/.nautalis` | Base directory for all Nautalis data |
| `general.logLevel` | string | `info` | Log level (debug, info, warn, error) |
| `general.telemetryEnabled` | boolean | `true` | Enable OpenTelemetry instrumentation |
| `general.configFile` | string | auto-detected | Explicit path to config file |

### Storage

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage.backend` | string | `sqlite` | Storage backend (sqlite, postgresql, supabase) |
| `storage.path` | string | `~/.nautalis/nautalis.db` | SQLite database path |
| `storage.connectionString` | string | — | PostgreSQL/Supabase connection string |
| `storage.poolSize` | number | `10` | Connection pool size (PostgreSQL only) |
| `storage.migrationsDir` | string | `./migrations` | Path to migration files |

### Embeddings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `embeddings.provider` | string | `ollama` | Embedding provider (ollama, openai, cohere, custom) |
| `embeddings.model` | string | `nomic-embed-text` | Model name for embeddings |
| `embeddings.baseUrl` | string | `http://localhost:11434` | API base URL |
| `embeddings.apiKey` | string | — | API key (for cloud providers) |
| `embeddings.dimensions` | number | `768` | Embedding vector dimensions |
| `embeddings.batchSize` | number | `32` | Batch size for embedding generation |

### Connectors

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectors.<id>.enabled` | boolean | `false` | Enable/disable connector |
| `connectors.<id>.watchMode` | boolean | `false` | Real-time event watching |
| `connectors.<id>.pollInterval` | string | `30s` | Polling interval for batch mode |
| `connectors.<id>.sessionPath` | string | — | Path to agent session logs |
| `connectors.<id>.projectPath` | string | `./` | Project root path |
| `connectors.<id>.ignoredPaths` | string[] | `[]` | Paths to ignore |

### Telemetry

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `telemetry.enabled` | boolean | `true` | Enable OpenTelemetry |
| `telemetry.exporter` | string | `console` | Exporter type (console, otlp, jaeger) |
| `telemetry.endpoint` | string | — | OTLP endpoint URL |
| `telemetry.serviceName` | string | `nautalis` | Service name for traces |
| `telemetry.serviceVersion` | string | `1.0.0` | Service version |
| `telemetry.sampleRate` | number | `1.0` | Trace sampling rate (0.0-1.0) |

### Memory

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `memory.defaultTTL` | string | `90d` | Default time-to-live for episodic memories |
| `memory.importanceThreshold` | number | `0.3` | Minimum importance to retain memory |
| `memory.maxContextMemories` | number | `10` | Max memories injected per session |
| `memory.enableDecay` | boolean | `true` | Enable importance decay |
| `memory.decayRate` | number | `0.01` | Daily decay rate for episodic memories |

### Orchestration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orchestration.conflictDetection` | boolean | `true` | Enable conflict detection |
| `orchestration.contextInjection` | boolean | `true` | Enable context injection |
| `orchestration.maxContextSize` | number | `4096` | Max context tokens per injection |
| `orchestration.relevanceThreshold` | number | `0.5` | Minimum relevance for context injection |

### MCP Server

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mcp.enabled` | boolean | `false` | Enable MCP server |
| `mcp.port` | number | `3456` | MCP server port |
| `mcp.host` | string | `localhost` | MCP server host |

### REST API

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `api.enabled` | boolean | `false` | Enable REST API server |
| `api.port` | number | `3000` | API server port |
| `api.host` | string | `localhost` | API server host |
| `api.authToken` | string | — | Bearer token for API authentication |

## Environment Variables

All config options can be set via environment variables using `NAUTALIS_` prefix with dot notation converted to underscores:

```bash
# General
export NAUTALIS_GENERAL_DATA_DIR="/opt/nautalis"
export NAUTALIS_GENERAL_LOG_LEVEL="debug"

# Storage
export NAUTALIS_STORAGE_BACKEND="postgresql"
export NAUTALIS_STORAGE_CONNECTION_STRING="postgresql://user:pass@host:5432/nautalis"

# Embeddings
export NAUTALIS_EMBEDDINGS_PROVIDER="openai"
export NAUTALIS_EMBEDDINGS_API_KEY="sk-..."
export NAUTALIS_EMBEDDINGS_MODEL="text-embedding-3-small"

# Telemetry
export NAUTALIS_TELEMETRY_EXPORTER="otlp"
export NAUTALIS_TELEMETRY_ENDPOINT="http://collector:4318"

# API
export NAUTALIS_API_ENABLED="true"
export NAUTALIS_API_PORT="8080"
export NAUTALIS_API_AUTH_TOKEN="your-secret-token"

# MCP
export NAUTALIS_MCP_ENABLED="true"
export NAUTALIS_MCP_PORT="3456"
```

## Example Configurations

### Personal (Default)

```toml
# nautalis.toml — Personal setup
[general]
dataDir = "~/.nautalis"
logLevel = "info"

[storage]
backend = "sqlite"
path = "~/.nautalis/nautalis.db"

[embeddings]
provider = "ollama"
model = "nomic-embed-text"
baseUrl = "http://localhost:11434"

[connectors.claude-code]
enabled = true
sessionPath = "~/.claude/sessions"

[connectors.kilo-code]
enabled = true
projectPath = "./"
watchMode = true
```

### Team

```toml
# nautalis.toml — Team setup
[general]
dataDir = "/opt/nautalis"
logLevel = "info"

[storage]
backend = "postgresql"
connectionString = "postgresql://nautalis:password@db.internal:5432/nautalis"
poolSize = 20

[embeddings]
provider = "openai"
model = "text-embedding-3-small"
apiKey = "${OPENAI_API_KEY}"

[connectors.claude-code]
enabled = true
sessionPath = "~/.claude/sessions"

[connectors.kilo-code]
enabled = true
projectPath = "./"
watchMode = true

[orchestration]
conflictDetection = true
contextInjection = true
maxContextSize = 8192

[api]
enabled = true
port = 3000
authToken = "${NAUTALIS_API_TOKEN}"
```

### Enterprise

```toml
# nautalis.toml — Enterprise setup
[general]
dataDir = "/opt/nautalis"
logLevel = "warn"

[storage]
backend = "supabase"
connectionString = "${SUPABASE_CONNECTION_STRING}"
poolSize = 50

[embeddings]
provider = "openai"
model = "text-embedding-3-large"
apiKey = "${OPENAI_API_KEY}"
dimensions = 3072

[telemetry]
enabled = true
exporter = "otlp"
endpoint = "http://otel-collector.internal:4318"
serviceName = "nautalis-prod"
sampleRate = 0.1

[orchestration]
conflictDetection = true
contextInjection = true
maxContextSize = 16384
relevanceThreshold = 0.7

[api]
enabled = true
port = 8080
authToken = "${NAUTALIS_API_TOKEN}"

[mcp]
enabled = true
port = 3456
```
