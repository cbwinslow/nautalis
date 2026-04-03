# ADR 004: SQLite as Default Storage

**Status:** Accepted  
**Date:** 2026-01-15  
**Context:** Default storage backend selection

## Decision

We chose **SQLite** (via better-sqlite3) as the default storage backend for Nautalis.

## Alternatives Considered

1. **PostgreSQL** — Full concurrent access, but requires server
2. **MongoDB** — Flexible schema, but overkill for structured data
3. **File-based JSON** — Simple, but no querying or transactions
4. **SQLite** — Zero-config, ACID, embedded, sufficient for single-user

## Rationale

### Zero Configuration

SQLite requires no server setup, no connection strings, no process management. The database is a single file:

```bash
# No setup needed — file is created automatically
~/.nautalis/nautalis.db
```

### ACID Compliance

SQLite provides full ACID guarantees:
- **Atomic** — Transactions are all-or-nothing
- **Consistent** — Database constraints are enforced
- **Isolated** — Concurrent reads don't interfere
- **Durable** — Committed data survives crashes

### Performance

For single-user workloads, SQLite is extremely fast:
- Read: < 1ms for indexed queries
- Write: < 5ms for single inserts
- Vector search: < 50ms with sqlite-vec extension

### Offline-First

SQLite works without any network connection, aligning with our zero-cost, offline-first principle.

### Vector Search

The `sqlite-vec` extension provides efficient vector similarity search:

```sql
SELECT m.*, vec_distance_cosine(m.embedding, ?) as distance
FROM memories m
ORDER BY distance LIMIT 10;
```

### Migration Path

When teams outgrow SQLite, migration to PostgreSQL is straightforward:

```bash
nautalis memory export --output backup.json
# Switch config to PostgreSQL
nautalis memory import --input backup.json
```

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|-----------|
| Single writer | WAL mode allows concurrent readers |
| No built-in replication | Not needed for personal use |
| File-based backup | Simple file copy or SQLite backup API |
| Limited concurrent writes | Switch to PostgreSQL for teams |

## Consequences

- **Positive:** Zero setup, fully offline, ACID compliant, fast for single-user
- **Negative:** Not suitable for concurrent multi-user access
- **Neutral:** Easy migration path to PostgreSQL when needed
