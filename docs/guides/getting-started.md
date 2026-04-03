# Getting Started Guide

Get Nautalis up and running in under 5 minutes.

## Prerequisites

- **Bun** (v1.0+) — Runtime
- **Ollama** (optional but recommended) — For local embeddings
- **Node.js** (v20+) — Alternative runtime if Bun unavailable

## Step 1: Install Nautalis

```bash
# Install globally with Bun
bun install -g @nautalis/orchestrator

# Or install from source
git clone <repo-url>
cd nautalis
bun install
bun run build
```

Verify installation:

```bash
nautalis --version
```

## Step 2: Install Ollama (Recommended)

For zero-cost local embeddings:

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the embedding model
ollama pull nomic-embed-text

# Start Ollama
ollama serve
```

Verify Ollama:

```bash
curl http://localhost:11434/api/tags
```

## Step 3: Initialize Nautalis

```bash
nautalis init
```

This creates:
- `~/.nautalis/` — Data directory
- `~/.nautalis/nautalis.db` — SQLite database
- `~/.nautalis/nautalis.toml` — Configuration file
- Database schema (via migrations)

**Output:**
```
✓ Nautalis initialized
  Storage:  SQLite (~/.nautalis/nautalis.db)
  Embeddings: Ollama (nomic-embed-text)
  Telemetry: Enabled (console)
  Config:   ~/.nautalis/nautalis.toml
```

## Step 4: Configure Connectors

Edit `~/.nautalis/nautalis.toml` to enable your AI tool connectors:

```toml
[connectors.claude-code]
enabled = true
sessionPath = "~/.claude/sessions"

[connectors.kilo-code]
enabled = true
projectPath = "./"
watchMode = true
```

## Step 5: Ingest Existing Data

Import your existing AI agent sessions:

```bash
# Ingest from all enabled connectors
nautalis ingest

# Or ingest from a specific connector
nautalis ingest --connector claude-code --since 7d

# Dry run to see what would be ingested
nautalis ingest --dry-run
```

**Output:**
```
Ingesting from claude-code (since 7d)...
  ✓ 127 events processed
  ✓ 89 memories created
  ✓ 38 events skipped (duplicates)
  Duration: 4.2s
```

## Step 6: Verify Everything Works

```bash
# Check system status
nautalis status

# Search your memories
nautalis search "database"

# Ask a question
nautalis ask "what have I been working on?"

# View recent timeline
nautalis timeline --since 2d
```

## Step 7: Enable Real-Time Watching (Optional)

For real-time memory capture during active development:

```bash
nautalis watch
```

This runs in the background and captures events as they happen from all enabled connectors.

## Next Steps

- [Configure Nautalis](../knowledge-base/configuration.md) — All configuration options
- [Set up Claude Code](connectors/claude-code.md) — Detailed Claude Code integration
- [Set up Kilo Code](connectors/kilo-code.md) — Detailed Kilo Code integration
- [Memory Management](memory-management.md) — Managing your memory store
- [Context Injection](context-injection.md) — Injecting context into agent sessions
- [Team Deployment](team-deployment.md) — Multi-user setup
