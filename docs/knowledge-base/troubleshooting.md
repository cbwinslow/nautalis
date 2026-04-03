# Troubleshooting

Common issues and their solutions.

## Ollama Connection Issues

### Problem: "Failed to connect to Ollama at http://localhost:11434"

**Causes:**
- Ollama is not running
- Ollama is running on a different port
- Firewall blocking localhost connections

**Solutions:**
```bash
# Check if Ollama is running
ollama list

# Start Ollama if not running
ollama serve

# Verify the model is pulled
ollama pull nomic-embed-text

# Test the API
curl http://localhost:11434/api/tags

# Check if port is in use
lsof -i :11434
```

**Custom port:** If Ollama runs on a non-default port:
```toml
[embeddings]
baseUrl = "http://localhost:11435"
```

### Problem: "Embedding generation is very slow"

**Solutions:**
- Use a smaller model (`all-minilm` instead of `nomic-embed-text`)
- Increase batch size: `batchSize = 64`
- Switch to OpenAI for faster cloud embeddings
- Check GPU acceleration: `ollama run nomic-embed-text` (should show GPU usage)

## SQLite Issues

### Problem: "database is locked"

**Cause:** Multiple processes trying to write to the SQLite database simultaneously.

**Solutions:**
```bash
# Check for stale lock files
ls -la ~/.nautalis/*.db-journal
ls -la ~/.nautalis/*.db-wal

# Remove stale journal (only if Nautalis is not running)
rm ~/.nautalis/nautalis.db-journal

# Switch to PostgreSQL for multi-user setups
NAUTALIS_STORAGE_BACKEND=postgresql
```

### Problem: "database file is corrupted"

**Solutions:**
```bash
# Try to recover
sqlite3 ~/.nautalis/nautalis.db "PRAGMA integrity_check;"

# Restore from backup
cp ~/.nautalis/nautalis.db.backup ~/.nautalis/nautalis.db

# Re-initialize and re-ingest
nautalis init --force
nautalis ingest
```

## PostgreSQL Issues

### Problem: "connection refused"

**Solutions:**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection string format
# Correct: postgresql://user:password@host:port/database
echo $NAUTALIS_STORAGE_CONNECTION_STRING

# Test connection directly
psql "postgresql://user:password@host:5432/nautalis" -c "SELECT 1;"
```

### Problem: "pgvector extension not found"

**Solutions:**
```bash
# Install pgvector
# On Ubuntu/Debian:
sudo apt install postgresql-16-pgvector

# On macOS with Homebrew:
brew install pgvector

# Enable extension in database
psql nautalis -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify installation
psql nautalis -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

## Connector Issues

### Problem: "No events ingested from claude-code"

**Solutions:**
```bash
# Check connector is enabled
nautalis connectors status

# Verify session path exists
ls -la ~/.claude/sessions/

# Check path configuration
nautalis connectors config claude-code

# Try manual ingest
nautalis ingest --connector claude-code --dry-run

# Check logs for errors
nautalis status --verbose
```

### Problem: "Watch mode not capturing events"

**Solutions:**
```bash
# Check file permissions
ls -la ~/.claude/sessions/

# Verify no ignored paths blocking events
nautalis connectors config claude-code

# Increase poll interval for slow systems
# In config: pollInterval: "60s"

# Check watch mode is enabled
nautalis watch --connector claude-code --verbose
```

## Memory Engine Issues

### Problem: "Memories not appearing in search"

**Solutions:**
```bash
# Check if embeddings were generated
nautalis memory list --limit 5 --full

# Verify embedding provider is connected
nautalis status

# Regenerate embeddings
nautalis memory regenerate-embeddings

# Check search query
nautalis search "your query" --verbose

# Verify memory status (not expired/archived)
nautalis memory list --status all
```

### Problem: "Context injection returns empty results"

**Solutions:**
```bash
# Check minimum relevance threshold
# Lower it in config: orchestration.relevanceThreshold = 0.3

# Verify there are memories to inject
nautalis memory list --limit 10

# Test context generation manually
nautalis context --query "your session topic" --verbose

# Check max context size isn't too small
# Increase: orchestration.maxContextSize = 8192
```

## API Server Issues

### Problem: "API server won't start"

**Solutions:**
```bash
# Check port availability
lsof -i :3000

# Use a different port
nautalis server --api --port 8080

# Check auth token is set
echo $NAUTALIS_API_AUTH_TOKEN

# Check logs
nautalis server --api --log-level debug
```

### Problem: "401 Unauthorized on API calls"

**Solutions:**
```bash
# Include the auth token
curl -H "Authorization: Bearer $NAUTALIS_API_AUTH_TOKEN" http://localhost:3000/api/v1/memories

# Verify token matches config
grep authToken nautalis.toml

# Generate a new token
openssl rand -hex 32
```

## MCP Server Issues

### Problem: "Agent can't connect to MCP server"

**Solutions:**
```bash
# Verify MCP server is running
nautalis server --mcp

# Check port
lsof -i :3456

# Test MCP endpoint
curl http://localhost:3456/mcp

# Verify agent MCP configuration
# Check agent's MCP settings point to correct URL
```

## Performance Issues

### Problem: "Nautalis is slow"

**Diagnosis:**
```bash
# Check memory count
nautalis status

# Check storage size
ls -lh ~/.nautalis/nautalis.db

# Enable telemetry for profiling
nautalis status --verbose

# Check embedding latency
nautalis telemetry metrics
```

**Solutions:**
- **High memory count (>50k):** Consider archiving old episodic memories
- **Large database:** Run `VACUUM` on SQLite
- **Slow embeddings:** Switch to OpenAI or increase Ollama batch size
- **Slow searches:** Ensure indexes exist, run `nautalis migrate`

```bash
# Vacuum SQLite
sqlite3 ~/.nautalis/nautalis.db "VACUUM;"

# Archive old episodic memories
nautalis memory archive --type episodic --older-than 90d
```

## Telemetry Issues

### Problem: "No traces appearing in collector"

**Solutions:**
```bash
# Verify telemetry is enabled
grep telemetryEnabled nautalis.toml

# Check exporter configuration
grep exporter nautalis.toml

# Test OTLP endpoint
curl -v http://collector:4318/v1/traces

# Check local console output
nautalis --log-level debug
```

## Common Error Codes

| Error | Code | Solution |
|-------|------|----------|
| Storage unavailable | 3 | Check storage backend is running and accessible |
| Connector failed | 4 | Verify connector configuration and agent paths |
| Embedding failed | 5 | Check embedding provider connectivity |
| Invalid command | 64 | Check command syntax with `--help` |
| Missing argument | 65 | Provide all required arguments |
| Internal error | 70 | Check logs, report with `--verbose` output |

## Getting Help

```bash
# Verbose output for any command
nautalis <command> --verbose

# Debug logging
nautalis <command> --log-level debug

# JSON output for debugging
nautalis <command> --json

# Full system status
nautalis status --verbose
```
