# Storage Backends

Nautalis supports multiple storage backends to accommodate different deployment scales.

## Overview

| Backend | Best For | Concurrency | Setup Cost | Cost |
|---------|----------|-------------|------------|------|
| **SQLite** | Personal, single-user | Single writer | Zero | Free |
| **PostgreSQL** | Team, multi-user | Full concurrent | Low | Free (self-hosted) |
| **Supabase** | Enterprise, scale | Full concurrent + real-time | Medium | Free tier / paid |

## SQLite (Personal)

The default storage backend. Zero configuration, fully offline.

**Configuration:**
```toml
[storage]
backend = "sqlite"
path = "~/.nautalis/nautalis.db"
```

**Features:**
- Zero setup — creates database file automatically
- Fully offline — no network required
- ACID compliant — transactional integrity
- Embedded — no separate process needed
- Fast for single-user workloads

**Limitations:**
- Single writer (WAL mode allows concurrent readers)
- No built-in replication
- File-based — backup requires file copy

**Schema:**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  classification TEXT,
  importance REAL NOT NULL DEFAULT 0.5,
  sensitivity TEXT NOT NULL DEFAULT 'public',
  embedding BLOB,
  embedding_model TEXT,
  embedding_dimensions INTEGER,
  metadata JSON NOT NULL,
  relationships JSON NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL,
  source_event_id TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_session ON memories(session_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_status ON memories(status);
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_expires ON memories(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSON NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  memory_id TEXT REFERENCES memories(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project TEXT,
  branch TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  context_snapshot JSON
);

CREATE TABLE connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  config JSON,
  last_heartbeat TIMESTAMP
);
```

**Vector Search:** SQLite uses the `sqlite-vec` extension for efficient vector similarity search:

```sql
-- Vector similarity search using sqlite-vec
SELECT m.*, vec_distance_cosine(m.embedding, ?) as distance
FROM memories m
WHERE m.status = 'active'
ORDER BY distance
LIMIT ?;
```

**Backup:**
```bash
# Simple file copy (stop Nautalis first or use WAL mode)
cp ~/.nautalis/nautalis.db ~/.nautalis/nautalis.db.backup

# Or use SQLite's backup API
sqlite3 ~/.nautalis/nautalis.db ".backup '~/.nautalis/backup.db'"
```

## PostgreSQL (Team)

For team deployments requiring concurrent access.

**Configuration:**
```toml
[storage]
backend = "postgresql"
connectionString = "postgresql://nautalis:password@db.internal:5432/nautalis"
poolSize = 20
```

**Features:**
- Full concurrent read/write access
- Connection pooling built-in
- Rich indexing and query optimization
- `pgvector` extension for vector search
- Row-level security for multi-tenant setups
- Backup and replication support

**Setup:**
```bash
# Create database
createdb nautalis

# Enable pgvector extension
psql nautalis -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
nautalis migrate
```

**Vector Search:** Uses `pgvector` extension:

```sql
-- Vector similarity search using pgvector
SELECT m.*, m.embedding <=> ?::vector as distance
FROM memories m
WHERE m.status = 'active'
ORDER BY distance
LIMIT ?;
```

**Environment Variables:**
```bash
export NAUTALIS_STORAGE_BACKEND=postgresql
export NAUTALIS_STORAGE_CONNECTION_STRING=postgresql://user:pass@host:5432/nautalis
export NAUTALIS_STORAGE_POOL_SIZE=20
```

## Supabase (Enterprise)

For enterprise deployments with horizontal scaling and real-time features.

**Configuration:**
```toml
[storage]
backend = "supabase"
connectionString = "${SUPABASE_CONNECTION_STRING}"
poolSize = 50
```

**Features:**
- Everything PostgreSQL offers, plus:
- Managed infrastructure
- Real-time subscriptions (activity feeds)
- Built-in authentication integration
- Automatic backups
- Horizontal scaling
- Edge functions for custom logic

**Setup:**
1. Create a Supabase project
2. Enable `pgvector` extension in the dashboard
3. Set the connection string in Nautalis config
4. Run migrations: `nautalis migrate`

**Real-time Activity Feed:**
```typescript
// Subscribe to new memories in real-time
const channel = supabase
  .channel('memories')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'memories'
  }, (payload) => {
    console.log('New memory:', payload.new);
  })
  .subscribe();
```

## Migration Between Backends

Nautalis provides tools to migrate data between storage backends.

### SQLite to PostgreSQL

```bash
# Export from SQLite
nautalis memory export --format json --output nautalis-export.json

# Import to PostgreSQL
NAUTALIS_STORAGE_BACKEND=postgresql \
NAUTALIS_STORAGE_CONNECTION_STRING="postgresql://..." \
nautalis memory import --input nautalis-export.json
```

### Programmatic Migration

```typescript
import { SQLiteStore } from './store/sqlite.js';
import { PostgreSQLStore } from './store/postgresql.js';

async function migrate(source: SQLiteStore, target: PostgreSQLStore): Promise<void> {
  await source.connect();
  await target.connect();

  const memories = await source.getAllMemories();
  for (const memory of memories) {
    await target.storeMemory(memory);
  }

  console.log(`Migrated ${memories.length} memories`);
}
```

### Migration Checklist

- [ ] Export all data from source backend
- [ ] Verify export integrity (count, checksums)
- [ ] Set up target backend
- [ ] Run migrations on target
- [ ] Import data to target
- [ ] Verify import integrity
- [ ] Update configuration
- [ ] Restart Nautalis with new backend
- [ ] Verify functionality
- [ ] Archive old backend data
