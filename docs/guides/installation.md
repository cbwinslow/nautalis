# Installation Guide

Install Nautalis and its dependencies.

## Prerequisites

| Dependency | Version | Required | Purpose |
|-----------|---------|----------|---------|
| **Bun** | 1.0+ | Yes | Runtime |
| **Ollama** | Latest | Recommended | Local embeddings |
| **Node.js** | 20+ | No (alternative to Bun) | Alternative runtime |

## Install Nautalis

### Global Install (Recommended)

```bash
bun install -g @nautalis/orchestrator
```

Verify:

```bash
nautalis --version
```

### Install from Source

```bash
git clone <repo-url>
cd nautalis
bun install
bun run build

# Link globally for CLI access
bun link
```

Verify:

```bash
nautalis --version
```

## Install Ollama

Ollama is the default embedding provider. It runs locally and costs nothing.

### macOS

```bash
brew install ollama
ollama pull nomic-embed-text
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
```

### Windows

Download from [ollama.com/download](https://ollama.com/download)

### Verify Ollama

```bash
ollama serve &
curl http://localhost:11434/api/tags
```

## Initialize Nautalis

```bash
nautalis init
```

This creates:
- `~/.nautalis/` — Data directory
- `~/.nautalis/nautalis.db` — SQLite database
- `~/.nautalis/nautalis.toml` — Configuration file

## Verify Installation

```bash
# Check status
nautalis status

# Run a test search
nautalis search "test"

# Check connectors
nautalis connectors status
```

## Docker Installation

```bash
docker run -d \
  --name nautalis \
  -p 3000:3000 \
  -p 3456:3456 \
  -v nautalis-data:/root/.nautalis \
  -e NAUTALIS_API_ENABLED=true \
  -e NAUTALIS_MCP_ENABLED=true \
  ghcr.io/nautalis/orchestrator:latest
```

## Update Nautalis

```bash
# Global install
bun update -g @nautalis/orchestrator

# From source
git pull
bun install
bun run build
```
