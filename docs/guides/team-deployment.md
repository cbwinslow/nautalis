# Team Deployment Guide

Deploy Nautalis for team-wide shared memory, conflict detection, and activity awareness.

## Overview

Team deployment enables:

- **Shared Memory** — All team members access the same memory store
- **Conflict Detection** — Automatic detection of overlapping or conflicting work
- **Activity Feeds** — Real-time visibility into team AI activity
- **Cross-Agent Awareness** — See what any agent on the team has done

## Architecture

```
┌──────────────────────────────────────────────┐
│                Team Network                   │
│                                               │
│  ┌────────┐  ┌────────┐  ┌────────┐          │
│  │ Dev 1  │  │ Dev 2  │  │ Dev 3  │          │
│  │ Nautalis│  │ Nautalis│  │ Nautalis│         │
│  │ Client │  │ Client │  │ Client │          │
│  └───┬────┘  └───┬────┘  └───┬────┘          │
│      │           │           │                 │
│      └───────────┼───────────┘                 │
│                  │                             │
│           ┌──────▼──────┐                      │
│           │  Nautalis    │                      │
│           │  Server      │                      │
│           │  (REST+MCP)  │                      │
│           └──────┬──────┘                      │
│                  │                             │
│           ┌──────▼──────┐                      │
│           │  PostgreSQL  │                      │
│           │  + pgvector  │                      │
│           └─────────────┘                      │
└──────────────────────────────────────────────┘
```

## Prerequisites

- PostgreSQL 15+ with pgvector extension
- Shared embedding provider (OpenAI API or shared Ollama instance)
- Network connectivity between team members and server

## Step 1: Set Up PostgreSQL

### Using Docker

```bash
docker run -d \
  --name nautalis-postgres \
  -e POSTGRES_DB=nautalis \
  -e POSTGRES_USER=nautalis \
  -e POSTGRES_PASSWORD=your-secure-password \
  -p 5432:5432 \
  -v nautalis-data:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
```

### Using Managed PostgreSQL

Create a PostgreSQL instance with pgvector on your cloud provider (AWS RDS, GCP Cloud SQL, etc.).

## Step 2: Configure the Server

Create `nautalis.toml` on the server:

```toml
[general]
dataDir = "/var/lib/nautalis"
logLevel = "info"

[storage]
backend = "postgresql"

[storage.postgresql]
host = "localhost"
port = 5432
database = "nautalis"
username = "nautalis"
password = "your-secure-password"
poolSize = 20

[embeddings]
provider = "openai"
model = "text-embedding-3-small"
apiKey = "${OPENAI_API_KEY}"

[server]
host = "0.0.0.0"
port = 3000

[server.auth]
enabled = true
apiKeys = ["${NAUTALIS_API_KEY}"]

[mcp]
enabled = true
port = 3456

[team]
enabled = true
projectId = "your-project-id"
teamName = "Engineering Team"

[team.conflictDetection]
enabled = true
sensitivity = "medium"

[team.activityFeed]
enabled = true
maxAge = "7d"
```

## Step 3: Initialize the Server

```bash
# Run migrations
nautalis db migrate

# Start the server
nautalis server --api --mcp

# Or in production, use a process manager
nautalis server --api --mcp --host 0.0.0.0
```

## Step 4: Configure Team Members

Each team member configures their local Nautalis to connect to the shared server:

```toml
# Team member's nautalis.toml
[general]
dataDir = "~/.nautalis"
logLevel = "info"

[storage]
backend = "postgresql"

[storage.postgresql]
host = "nautalis-server.internal"
port = 5432
database = "nautalis"
username = "nautalis"
password = "your-secure-password"

[embeddings]
provider = "openai"
model = "text-embedding-3-small"
apiKey = "${OPENAI_API_KEY}"

[team]
enabled = true
projectId = "your-project-id"
teamName = "Engineering Team"

[connectors.claude-code]
enabled = true
watchMode = true

[connectors.kilo-code]
enabled = true
watchMode = true
```

## Step 5: Enable Conflict Detection

Conflict detection identifies when team members (or their agents) are working on overlapping areas:

```toml
[team.conflictDetection]
enabled = true
sensitivity = "medium"       # low, medium, high
notifyOnConflict = true
notifyChannels = ["slack", "email"]
```

### Conflict Types Detected

| Type | Description | Example |
|------|-------------|---------|
| **File Conflict** | Two agents editing the same file | Dev 1 and Dev 2 both modifying auth.ts |
| **Decision Conflict** | Contradictory decisions | One agent decides to use X, another decides Y |
| **Pattern Conflict** | Different approaches to same problem | Different error handling patterns |
| **Resource Conflict** | Competing for same resources | Both agents modifying the same database table |

### Viewing Conflicts

```bash
# View active conflicts
nautalis team conflicts

# View conflict history
nautalis team conflicts --history

# Resolve a conflict
nautalis team conflicts resolve <conflict-id> --resolution "accepted"
```

## Step 6: Activity Feed

The activity feed shows real-time team AI activity:

```bash
# View activity feed
nautalis team activity

# Filter by team member
nautalis team activity --member alice

# Filter by time range
nautalis team activity --since 1h

# Filter by agent type
nautalis team activity --agent claude-code
```

## Step 7: Shared Context

Team members can inject shared context into their sessions:

```bash
# Get context including team activity
nautalis context --include-team

# Get context for a specific project
nautalis context --project my-app --include-team

# Get context with conflict warnings
nautalis context --include-conflicts
```

## Docker Compose Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: nautalis
      POSTGRES_USER: nautalis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  nautalis:
    build: .
    environment:
      NAUTALIS_STORAGE_BACKEND: postgresql
      NAUTALIS_STORAGE_CONNECTION_STRING: postgresql://nautalis:${POSTGRES_PASSWORD}@postgres:5432/nautalis
      NAUTALIS_EMBEDDINGS_PROVIDER: openai
      NAUTALIS_EMBEDDINGS_API_KEY: ${OPENAI_API_KEY}
      NAUTALIS_API_AUTH_TOKEN: ${NAUTALIS_API_KEY}
      NAUTALIS_TEAM_ENABLED: "true"
      NAUTALIS_TEAM_PROJECT_ID: ${PROJECT_ID}
    ports:
      - "3000:3000"
      - "3456:3456"
    depends_on:
      - postgres

volumes:
  postgres-data:
```

```bash
# Start the stack
docker-compose up -d

# Run migrations
docker-compose exec nautalis nautalis db migrate
```

## Security Considerations

1. **API Keys**: Use strong, unique API keys for each team member
2. **Network**: Run PostgreSQL on a private network, not exposed to the internet
3. **TLS**: Enable SSL for PostgreSQL connections in production
4. **Backups**: Configure automated database backups
5. **Access Control**: Use Row Level Security (RLS) for fine-grained access

```toml
[storage.postgresql]
ssl = true
sslMode = "require"
```

## Monitoring

```bash
# Check team status
nautalis team status

# View team statistics
nautalis team stats

# Monitor server health
nautalis status
```

## Next Steps

- [Enterprise Setup](enterprise-setup.md)
- [Configuration Reference](../knowledge-base/configuration.md)
- [Troubleshooting](../knowledge-base/troubleshooting.md)
