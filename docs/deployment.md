# Nautalis Deployment Guide

Nautalis supports two deployment modes:

1. **Docker Compose** — All-in-one containerized stack with PostgreSQL + TimescaleDB + pgvector.
2. **Bare Metal** — Use existing PostgreSQL 16+ installation with required extensions.

---

## Prerequisites

- Node.js 20+ or Bun runtime
- PostgreSQL 16+ (if not using Docker)
- Required extensions: `pgvector`, `pg_trgm`, `uuid-ossp`, `btree_gin`, optional: `timescaledb`

---

## Option 1: Docker Compose (Recommended)

The fastest way to get started.

```bash
# From the project root
docker compose -f docker/docker-compose.yml up -d
```

This starts:
- `nautalis` application on http://localhost:3001
- `postgres` database on localhost:5432 (database `nautalis`, user `nautalis`, password `nautalis`)
- Migrations are applied automatically on first startup

The application will use the environment variables defined in the compose file:

```yaml
environment:
  - DATABASE_URL=postgresql://nautalis:nautalis@postgres:5432/nautalis
  - NAUTALIS_DB_DRIVER=postgres
  - NAUTALIS_EMBED_PROVIDER=ollama
```

To stop:

```bash
docker compose -f docker/docker-compose.yml down
```

---

## Option 2: Bare Metal Installation

If you already have PostgreSQL installed locally (or on a server), follow these steps.

### 2.1 Install Required Extensions

On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install postgresql-16-pgvector postgresql-16-pgtrgm postgresql-16-uuid-ossp postgresql-16-btree-gin
# Optional (TimescaleDB):
# sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -cs) main' > /etc/apt/sources.list.d/timescaledb.list"
# wget -qO- https://packagecloud.io/timescale/timescaledb/keys/gpg | sudo apt-key add -
# sudo apt update && sudo apt install timescaledb-2-postgresql-16
```

On other platforms, use the appropriate package manager or compile from source.

Enable extensions in the **target database** (you'll do this during migration).

### 2.2 Create Database Role and Database

```bash
# Switch to postgres superuser
sudo -u postgres psql

-- In psql:
CREATE ROLE nautalis WITH SUPERUSER LOGIN PASSWORD 'nautalis';
CREATE DATABASE nautalis OWNER nautalis;
\q
```

**Note:** The role needs `SUPERUSER` to create extensions. For production, you may restrict this after setup.

### 2.3 Set Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` to match your setup:

```ini
# Option A: Use a single DATABASE_URL
DATABASE_URL=postgresql://nautalis:nautalis@localhost:5432/nautalis

# Option B: Use individual PG_* variables (also supported)
# PG_HOST=localhost
# PG_PORT=5432
# PG_DATABASE_NAME=nautalis
# PG_DATABASE_USER=nautalis
# PG_DATABASE_PASSWORD=nautalis

NAUTALIS_DB_DRIVER=postgres
NAUTALIS_EMBED_PROVIDER=ollama
NAUTALIS_EMBED_OLLAMA_URL=http://localhost:11434
NAUTALIS_LLM_PROVIDER=ollama
NAUTALIS_LLM_OLLAMA_URL=http://localhost:11434
```

### 2.4 Run Migrations

```bash
bun run db:migrate
```

The script will:
1. Connect to the database
2. Check for required extensions (TimescaleDB optional)
3. Apply all core and RLS migrations
4. Apply TimescaleDB migrations only if the extension is available

If TimescaleDB is not installed, you'll see a warning but core schema still applies.

### 2.5 Initialize and Start Nautalis

```bash
# Build (if needed)
bun run build

# Start the daemon
bun start  # or: nautalis daemon start
```

Or use the CLI to initialize and check status:

```bash
nautalis init
nautalis status
```

---

## Configuration Reference

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required if not using `PG_*` |
| `PG_HOST`, `PG_PORT`, `PG_DATABASE_NAME`, `PG_DATABASE_USER`, `PG_DATABASE_PASSWORD` | Alternate way to specify connection | Used if `DATABASE_URL` not set |
| `NAUTALIS_DB_DRIVER` | Database driver (`postgres` or `supabase`) | `postgres` |
| `NAUTALIS_DEPLOYMENT` | Deployment mode marker (`local`, `docker`, `baremetal`) | `local` |
| `NAUTALIS_USER_ID` | Default user ID for operations | Current OS user |
| `NAUTALIS_TEAM_ID` | Default team ID (if using teams) | none |
| `NAUTALIS_EMBED_PROVIDER` | Embedding provider (`ollama`, `openai`, `cohere`, `custom`) | `ollama` |
| `NAUTALIS_EMBED_OLLAMA_URL` | Ollama URL for embeddings | `http://localhost:11434` |
| `NAUTALIS_LLM_PROVIDER` | LLM provider for extraction/summarization | `ollama` |
| `NAUTALIS_LLM_OLLAMA_URL` | Ollama URL for LLM | `http://localhost:11434` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint | none |

### Multi-Provider Configuration

For advanced setups with multiple providers, define a `providers` map in your config file:

```json
{
  "providers": {
    "ollama-local": {
      "type": "ollama",
      "url": "http://localhost:11434",
      "model": "nomic-embed-text"
    }
  },
  "embeddings": {
    "provider": "ollama-local"
  }
}
```

---

## Database Extensions Status

After successful setup, run:

```sql
\dx
```

You should see:

```
 btree_gin  | 1.3
 pg_trgm    | 1.6
 pgcrypto   | 1.3
 uuid-ossp  | 1.1
 vector     | 0.8.0
 timescaledb| 2.13  (optional)
```

---

## Troubleshooting

### `ERROR: extension "vector" does not exist`

Install pgvector: `sudo apt install postgresql-16-pgvector` (adjust version).

### TimescaleDB warnings during migration

If you don't need time-series features, you can ignore the warning. To enable TimescaleDB, install the extension and re-run `bun run db:migrate`.

### Connection refused on localhost:5432

Ensure PostgreSQL is running: `sudo systemctl status postgresql`. Check `pg_hba.conf` to allow local connections.

---

## Docker vs Bare Metal Comparison

| Feature | Docker Compose | Bare Metal |
|---------|---------------|------------|
| Setup time | ~5 minutes | ~30 minutes (if PostgreSQL already installed) |
| Extensions | Pre-installed | Must install manually |
| Isolation | Complete (container) | Shared system PostgreSQL |
| Persistence | Docker volume | Native PGDATA |
| Port conflicts | Uses internal network | Uses host port 5432 |
| Production ready | Yes (with config) | Yes (requires hardening) |

---

## Observability

The Docker Compose deployment includes an optional observability stack:

- **OpenTelemetry Collector** listens on ports `4317` (gRPC) and `4318` (HTTP) to receive telemetry from Nautalis.
- **Jaeger** provides trace visualization at http://localhost:16686
- **Grafana** provides dashboards at http://localhost:3000 (default admin password: `admin` or set `GRAFANA_PASSWORD`)

Metrics are also stored directly in the TimescaleDB `telemetry` hypertable as a fallback when the collector is unavailable.

### Accessing Components

- **Jaeger UI**: Open http://localhost:16686 to search traces.
- **Grafana**: Open http://localhost:3000 (default admin password: `admin` or set `GRAFANA_PASSWORD`). A pre-provisioned dashboard named "Nautalis Observability" should be available automatically, showing key metrics from TimescaleDB. You can also create custom dashboards using the PostgreSQL data source.

### Data Source Configuration

Grafana is provisioned with a dashboard that queries the `telemetry` table (for metrics) and `events_daily_stats` view (for event counts). To ensure queries work, add a PostgreSQL data source in Grafana pointing to the Nautalis database:

- Host: `postgres` (Docker network) or `localhost` (if running locally)
- Database: `nautalis`
- User: `nautalis`
- Password: `nautalis`

The dashboard uses this data source to display:

- Events ingested (24h)
- Query latency p95 (last hour)
- Errors count (24h)
- Memories stored (24h)

If you prefer to import the dashboard manually, the JSON file is located at `docker/grafana/nautalis-dashboard.json`.

### Enabling Full Observability

The collector is enabled by default in Docker Compose. To use it:

1. Ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is set to `http://otel-collector:4318` (already set in the compose file).
2. Start the stack: `docker compose -f docker/docker-compose.yml up -d`
3. Open Jaeger/Grafana in your browser.

If you do not wish to use the collector, you can remove the `otel-collector`, `jaeger`, and `grafana` services from the compose file and set `OTEL_EXPORTER_OTLP_ENDPOINT` empty; metrics will continue to be stored in TimescaleDB.

---


## Next Steps

After deployment:

1. Create a team: `nautalis team create "My Team"`
2. Install AI agent hooks: `nautalis hooks install claude`
3. Start ingesting events: `nautalis ingest --watch`
4. Search memories: `nautalis search "your query"`
5. Ask questions: `nautalis ask "What was decided?"`

Refer to `README.md` for additional commands and usage.
