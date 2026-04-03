# Memory Management Guide

Manage your Nautalis memory store — organize, clean, and optimize your AI agent memories.

## Memory Lifecycle

```
Created ──→ Active ──→ Archived ──→ Expired ──→ Deleted
              │                        │
              └──→ Decayed ────────────┘
```

1. **Created** — Memory ingested and stored
2. **Active** — Available for search and context injection
3. **Decayed** — Importance reduced over time (episodic only)
4. **Archived** — Manually or automatically archived
5. **Expired** — Past TTL, no longer injected
6. **Deleted** — Permanently removed

## Listing Memories

```bash
# List recent memories
nautalis memory list --limit 20

# Filter by type
nautalis memory list --type decision

# Filter by agent
nautalis memory list --agent claude-code

# Filter by date range
nautalis memory list --since 7d

# Filter by importance
nautalis memory list --min-importance 0.7

# Show full content
nautalis memory list --full

# Export to JSON
nautalis memory export --format json --output memories.json
```

## Viewing Individual Memories

```bash
# Get a specific memory
nautalis memory get <id>

# Show relationships
nautalis memory get <id> --relationships

# Show embedding info
nautalis memory get <id> --embedding
```

## Deleting Memories

```bash
# Delete a single memory
nautalis memory delete <id>

# Force delete (skip confirmation)
nautalis memory delete <id> --force

# Delete multiple memories
nautalis memory delete <id1> <id2> <id3>

# Delete by filter
nautalis memory delete --type episodic --older-than 90d --force
```

## Updating Memories

```bash
# Update memory content
nautalis memory update <id> --content "New content"

# Update metadata
nautalis memory update <id> --metadata '{"tags": ["important"]}'

# Update importance
nautalis memory update <id> --importance 0.9

# Update sensitivity
nautalis memory update <id> --sensitivity private
```

## Linking Memories

Create relationships between memories:

```bash
# Link two memories
nautalis memory link <source-id> <target-id> --type causes

# Available relationship types:
# caused_by, causes, related_to, contradicts, refines,
# supersedes, depends_on, implements, learned_from,
# same_session, same_topic, same_file
```

## Archiving

Archive old memories to keep active store lean:

```bash
# Archive episodic memories older than 90 days
nautalis memory archive --type episodic --older-than 90d

# Archive low-importance memories
nautalis memory archive --max-importance 0.2

# List archived memories
nautalis memory list --status archived

# Restore archived memory
nautalis memory restore <id>
```

## Regenerating Embeddings

When switching embedding providers or models:

```bash
# Regenerate all embeddings
nautalis memory regenerate-embeddings

# Regenerate with specific provider
nautalis memory regenerate-embeddings --provider openai

# Regenerate only unembedded memories
nautalis memory regenerate-embeddings --only-missing
```

## Import/Export

```bash
# Export all memories
nautalis memory export --output memories.json

# Export filtered memories
nautalis memory export --type decision --output decisions.json

# Import memories
nautalis memory import --input memories.json

# Import with merge (skip duplicates)
nautalis memory import --input memories.json --merge

# Import with overwrite (update existing)
nautalis memory import --input memories.json --overwrite
```

## Cleanup

```bash
# Remove expired memories
nautalis memory cleanup --expired

# Remove orphaned events (no associated memory)
nautalis memory cleanup --orphans

# Vacuum database (SQLite)
nautalis memory cleanup --vacuum

# Full cleanup
nautalis memory cleanup --all
```

## Memory Statistics

```bash
# Show memory statistics
nautalis status

# Detailed statistics
nautalis memory stats
```

**Output:**
```
Memory Statistics:
  Total memories:     1,247
  Active:             1,180
  Archived:           52
  Expired:            15

  By type:
    Episodic:         623 (50%)
    Semantic:         234 (19%)
    Procedural:       156 (13%)
    Decision:         134 (11%)
    Lesson:           67  (5%)
    Preference:       33  (3%)

  By agent:
    claude-code:      789 (63%)
    kilo-code:        458 (37%)

  Storage: 42.3 MB
  Embeddings: All generated (nomic-embed-text, 768d)
```

## Best Practices

### Regular Maintenance

```bash
# Weekly: Archive old episodic memories
nautalis memory archive --type episodic --older-than 30d

# Monthly: Clean up expired memories
nautalis memory cleanup --expired

# Quarterly: Full maintenance
nautalis memory cleanup --all
nautalis memory regenerate-embeddings --only-missing
```

### Importance Tuning

Adjust importance thresholds based on your needs:

```toml
[memory]
importanceThreshold = 0.3    # Memories below this are candidates for archival
enableDecay = true           # Enable importance decay for episodic
decayRate = 0.01             # 1% per day
```

### Storage Optimization

For large memory stores:

```bash
# Check database size
ls -lh ~/.nautalis/nautalis.db

# Vacuum to reclaim space
sqlite3 ~/.nautalis/nautalis.db "VACUUM;"

# Consider migrating to PostgreSQL if > 1GB
# See: ../knowledge-base/storage-backends.md
```
