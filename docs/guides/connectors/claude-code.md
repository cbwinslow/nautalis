# Claude Code Integration

Integrate Claude Code with Nautalis to capture session activity, decisions, and learnings.

## Overview

The Claude Code connector captures:
- Tool calls (ReadFile, WriteFile, Bash, etc.)
- File edits and modifications
- Command executions
- Decisions made during sessions
- Errors and their resolutions
- Session metadata (duration, files touched, model used)

## Setup

### 1. Enable the Connector

In your `nautalis.toml`:

```toml
[connectors.claude-code]
enabled = true
sessionPath = "~/.claude/sessions"
watchMode = false
pollInterval = "30s"
```

### 2. Locate Claude Code Sessions

Claude Code stores session data in:

| OS | Path |
|----|------|
| macOS | `~/.claude/sessions/` |
| Linux | `~/.claude/sessions/` |
| Windows | `%USERPROFILE%\.claude\sessions\` |

Verify the path:

```bash
ls -la ~/.claude/sessions/
```

### 3. Ingest Existing Sessions

```bash
# Ingest all available sessions
nautalis ingest --connector claude-code

# Ingest recent sessions only
nautalis ingest --connector claude-code --since 2d

# Preview what would be ingested
nautalis ingest --connector claude-code --dry-run
```

### 4. Enable Watch Mode (Optional)

For real-time event capture:

```toml
[connectors.claude-code]
watchMode = true
pollInterval = "10s"
```

```bash
nautalis watch --connector claude-code
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable connector |
| `sessionPath` | string | `~/.claude/sessions` | Path to Claude Code sessions |
| `watchMode` | boolean | `false` | Real-time event watching |
| `pollInterval` | string | `30s` | Polling interval for batch mode |
| `ignoredSessions` | string[] | `[]` | Session IDs to skip |

## Event Types Captured

| Event Type | Description | Memory Type |
|------------|-------------|-------------|
| `tool_call` | Claude used a tool (ReadFile, WriteFile, etc.) | episodic |
| `file_edit` | File was modified | episodic |
| `command` | Shell command was executed | episodic |
| `decision` | Claude made a design/architecture decision | decision |
| `error` | An error occurred and was handled | lesson |
| `pattern` | A code pattern was identified or applied | procedural |

## Example Captured Memory

```json
{
  "id": "mem_abc123",
  "agentId": "claude-code",
  "sessionId": "sess_xyz789",
  "type": "decision",
  "content": "Chose to implement rate limiting using a sliding window algorithm with Redis as the backing store",
  "summary": "Rate limiting: sliding window + Redis",
  "classification": {
    "categories": ["architecture", "infrastructure"],
    "subcategories": ["rate-limiting", "redis"],
    "confidence": 0.92
  },
  "importance": 0.85,
  "metadata": {
    "agent": { "id": "claude-code", "name": "Claude Code", "model": "claude-sonnet-4-20250514" },
    "project": { "name": "my-api", "path": "/projects/my-api", "branch": "feature/rate-limiting" },
    "event": {
      "type": "decision",
      "files": ["src/middleware/rate-limit.ts", "src/config/redis.ts"],
      "duration": 45000
    }
  }
}
```

## Troubleshooting

### No sessions found

```bash
# Verify Claude Code has been used
ls -la ~/.claude/sessions/

# Check session path in config
nautalis connectors config claude-code

# Override path if needed
nautalis ingest --connector claude-code --session-path /custom/path
```

### Sessions parsing fails

```bash
# Check session file format
head -n 5 ~/.claude/sessions/latest.json

# Enable debug logging
nautalis ingest --connector claude-code --log-level debug
```
