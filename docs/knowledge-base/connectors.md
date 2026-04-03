# Connectors

Connectors are pluggable integrations that bridge Nautalis with external AI coding tools. They translate agent-specific events into Nautalis's unified memory schema.

## Connector Interface

Every connector implements the `Connector` interface:

```typescript
export interface Connector {
  id: string;
  name: string;
  version: string;

  initialize(config: ConnectorConfig): Promise<void>;
  captureEvent(event: AgentEvent): Promise<MemoryRecord>;
  streamEvents(): AsyncIterable<AgentEvent>;
  healthCheck(): Promise<HealthStatus>;
  shutdown(): Promise<void>;
}
```

| Method | Description |
|--------|-------------|
| `initialize()` | Set up the connector with configuration (paths, hooks, API keys) |
| `captureEvent()` | Convert a single agent event into a `MemoryRecord` |
| `streamEvents()` | Return an async iterable of events (for watch mode) |
| `healthCheck()` | Verify the connector can communicate with its agent |
| `shutdown()` | Clean up resources, remove hooks, close connections |

## Registry Pattern

Connectors use a singleton registry with auto-registration:

```typescript
// src/connectors/registry.ts
export class ConnectorRegistry {
  private static instance: ConnectorRegistry;
  private connectors: Map<string, Connector> = new Map();

  static getInstance(): ConnectorRegistry {
    if (!ConnectorRegistry.instance) {
      ConnectorRegistry.instance = new ConnectorRegistry();
    }
    return ConnectorRegistry.instance;
  }

  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }

  async initializeAll(config: GlobalConfig): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.initialize(config.forConnector(connector.id));
    }
  }

  async healthCheckAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    for (const [id, connector] of this.connectors) {
      results.set(id, await connector.healthCheck());
    }
    return results;
  }
}
```

## Auto-Registration

Connectors register themselves as a side effect of their module import:

```typescript
// src/connectors/claude-code/index.ts
import { ConnectorRegistry } from '../registry.js';
import { ClaudeCodeConnector } from './connector.js';

const connector = new ClaudeCodeConnector();
ConnectorRegistry.getInstance().register(connector);

export { ClaudeCodeConnector };
```

This means importing the connector module automatically registers it:

```typescript
// src/index.ts
import './connectors/claude-code/index.js';
import './connectors/kilo-code/index.js';
import './connectors/filesystem/index.js';

// All connectors are now registered in the registry
const registry = ConnectorRegistry.getInstance();
```

## Available Connectors

### Claude Code

- **ID:** `claude-code`
- **Source:** Claude Code session logs (`.claude/sessions/`)
- **Events captured:** Tool calls, file edits, command executions, decisions, errors
- **Hook:** Post-session log parsing + optional file watcher
- **Configuration:**
  ```yaml
  connectors:
    claude-code:
      enabled: true
      sessionPath: ~/.claude/sessions
      watchMode: false
      pollInterval: 30s
  ```

### Kilo Code

- **ID:** `kilo-code`
- **Source:** Kilo Code activity logs and file system changes
- **Events captured:** Code edits, file operations, agent decisions, tool usage
- **Hook:** File watcher on project directory + log parser
- **Configuration:**
  ```yaml
  connectors:
    kilo-code:
      enabled: true
      projectPath: ./
      watchMode: true
      ignoredPaths:
        - node_modules
        - .git
        - dist
  ```

### FileSystem

- **ID:** `filesystem`
- **Source:** Direct file system monitoring
- **Events captured:** File creations, modifications, deletions
- **Hook:** chokidar file watcher
- **Configuration:**
  ```yaml
  connectors:
    filesystem:
      enabled: true
      watchPaths:
        - ./src
        - ./tests
      ignoredPatterns:
        - "**/*.log"
        - "**/node_modules/**"
  ```

## How to Add a New Connector

1. **Create directory:** `src/connectors/<agent-name>/`

2. **Implement the connector class:**

```typescript
// src/connectors/my-agent/connector.ts
export class MyAgentConnector implements Connector {
  readonly id = 'my-agent';
  readonly name = 'My Agent';
  readonly version = '1.0.0';

  async initialize(config: ConnectorConfig): Promise<void> {
    // Set up paths, hooks, watchers
  }

  async captureEvent(event: AgentEvent): Promise<MemoryRecord> {
    // Translate agent event to memory record
  }

  async *streamEvents(): AsyncIterable<AgentEvent> {
    // Yield events as they occur
  }

  async healthCheck(): Promise<HealthStatus> {
    // Verify connectivity
  }

  async shutdown(): Promise<void> {
    // Clean up resources
  }
}
```

3. **Create auto-registration index:**

```typescript
// src/connectors/my-agent/index.ts
import { ConnectorRegistry } from '../registry.js';
import { MyAgentConnector } from './connector.js';

const connector = new MyAgentConnector();
ConnectorRegistry.getInstance().register(connector);

export { MyAgentConnector };
```

4. **Add tests:** `test/integration/connectors/my-agent/`

5. **Update documentation:** Add entry to this page

## Hook Installation Process

Connectors can install hooks to capture events in real-time:

### Git Hooks

For agents that use git repositories:

```typescript
import { writeFileSync } from 'fs';
import { join } from 'path';

export function installGitHook(repoPath: string): void {
  const hookPath = join(repoPath, '.git', 'hooks', 'post-commit');
  writeFileSync(hookPath, '#!/bin/bash\nnautalis ingest --source git-hook\n', { mode: 0o755 });
}
```

### File Watchers

For real-time file system monitoring:

```typescript
import chokidar from 'chokidar';

export function watchFiles(paths: string[], ignored: string[]): AsyncIterable<FileEvent> {
  const watcher = chokidar.watch(paths, { ignored, ignoreInitial: true });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const [event, path] of watcher.iterator()) {
        yield { type: event, path, timestamp: new Date() };
      }
    },
  };
}
```

### Log Parsing

For agents that write session logs:

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export async function *parseLogFile(logPath: string): AsyncIterable<AgentEvent> {
  const fileStream = createReadStream(logPath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      yield JSON.parse(line) as AgentEvent;
    } catch {
      // Skip malformed lines
    }
  }
}
```

## Watch Mode vs Batch Ingestion

### Watch Mode (Real-Time)

```bash
nautalis watch --connector claude-code
```

- Runs continuously in the background
- Captures events as they happen
- Lower latency, higher resource usage
- Best for active development sessions

### Batch Ingestion

```bash
nautalis ingest --since 1d
```

- Processes existing logs/sessions in bulk
- One-time operation
- Higher throughput, no ongoing resource cost
- Best for catching up on past activity

### Comparison

| Aspect | Watch Mode | Batch Ingestion |
|--------|-----------|-----------------|
| Latency | Real-time (< 1s) | Deferred (on demand) |
| Resource usage | Continuous | One-time spike |
| Completeness | May miss events during downtime | Processes all historical data |
| Best for | Active development | Initial setup, catch-up |

**Recommendation:** Use both. Run watch mode during active development and periodically run batch ingestion to catch any missed events.
