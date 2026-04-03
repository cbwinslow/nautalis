# Kilo Code Integration

This guide covers integrating Nautalis with Kilo Code for real-time memory capture and context injection.

## Overview

The Kilo Code connector captures:

- Tool calls and their results
- File edits and modifications
- Commands executed
- Lessons learned during sessions
- Session start/end events

## Prerequisites

- Kilo Code installed and configured
- Nautalis initialized in your project

## Configuration

### Enable the Connector

```bash
nautalis connectors enable kilo-code
```

### Configuration Options

```toml
[connectors.kilo-code]
enabled = true
projectPath = "./"
watchMode = true
pollInterval = "5s"
sessionDir = ".kilocode/sessions"
ignoredPaths = ["node_modules", ".git", "dist"]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the connector |
| `projectPath` | string | `./` | Project root directory |
| `watchMode` | boolean | `false` | Real-time file watching |
| `pollInterval` | string | `5s` | Polling interval for batch mode |
| `sessionDir` | string | `.kilocode/sessions` | Path to session files |
| `ignoredPaths` | string[] | `["node_modules"]` | Paths to exclude |

## Batch Ingestion

Import existing Kilo Code sessions:

```bash
# Ingest all sessions
nautalis ingest --connector kilo-code

# Ingest recent sessions only
nautalis ingest --connector kilo-code --since 7d

# Dry run
nautalis ingest --connector kilo-code --dry-run
```

## Real-Time Watching

Monitor Kilo Code activity in real-time:

```bash
# Start watching
nautalis watch --connector kilo-code

# Watch with verbose output
nautalis watch --connector kilo-code --verbose
```

## Event Types

The Kilo Code connector captures these event types:

| Event Type | Description | Memory Type |
|------------|-------------|-------------|
| `tool_call` | Tool invocations (ReadFile, WriteFile, etc.) | episodic |
| `file_edit` | File modifications | episodic, semantic |
| `command` | Shell commands executed | episodic, procedural |
| `lesson` | Lessons learned during sessions | lesson |
| `session_start` | New session started | episodic |
| `session_end` | Session completed | decision, lesson |

## Context Injection

Inject Kilo Code memories into new sessions:

```bash
# Generate context for Kilo Code
nautalis context --agent kilo-code --project ./

# Output as markdown for CLAUDE.md-style injection
nautalis context --agent kilo-code --format markdown
```

## Troubleshooting

### No Sessions Found

```bash
# Verify session directory exists
ls -la .kilocode/sessions/

# Check connector configuration
nautalis config get connectors.kilo-code.sessionDir
```

### Watch Mode Not Working

```bash
# Check file watcher
nautalis watch --connector kilo-code --verbose

# Verify file permissions
ls -la .kilocode/
```

## Next Steps

- [Adding New Connectors](adding-connectors.md)
- [Memory Management](../memory-management.md)
- [Context Injection](../context-injection.md)
