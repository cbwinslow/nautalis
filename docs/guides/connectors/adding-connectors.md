# Adding New Connectors

This guide walks through creating a new connector for an AI agent not yet supported by Nautalis.

## Connector Architecture

Connectors follow a standard pattern:

```
src/connectors/<agent-name>/
├── connector.ts      # Main connector class
├── types.ts          # Agent-specific types
├── parser.ts         # Event parsing logic
├── config.ts         # Configuration schema
└── index.ts          # Auto-registration
```

## Step 1: Create Directory Structure

```bash
mkdir -p src/connectors/<agent-name>/
mkdir -p test/integration/connectors/<agent-name>/
```

## Step 2: Define Agent-Specific Types

```typescript
// src/connectors/<agent-name>/types.ts

export interface <AgentName>Event {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface <AgentName>Config {
  enabled: boolean;
  sessionPath: string;
  watchMode: boolean;
  pollInterval: string;
  ignoredPaths?: string[];
}
```

## Step 3: Implement the Connector

```typescript
// src/connectors/<agent-name>/connector.ts
import { Connector, ConnectorConfig, AgentEvent, MemoryRecord, HealthStatus } from '../base.js';
import { ConnectorRegistry } from '../registry.js';

export class <AgentName>Connector implements Connector {
  readonly id = '<agent-name>';
  readonly name = '<Agent Display Name>';
  readonly version = '1.0.0';

  private config: <AgentName>Config | null = null;
  private watcher: ReturnType<typeof chokidar.watch> | null = null;

  async initialize(config: ConnectorConfig): Promise<void> {
    this.config = config as <AgentName>Config;

    if (!this.config.enabled) {
      return;
    }

    // Validate configuration
    if (!this.config.sessionPath) {
      throw new Error('<agent-name> connector requires sessionPath');
    }

    // Set up file watcher if watch mode enabled
    if (this.config.watchMode) {
      this.setupWatcher();
    }
  }

  async captureEvent(event: AgentEvent): Promise<MemoryRecord> {
    // Translate agent event to memory record
    return {
      id: generateId(),
      agentId: this.id,
      sessionId: event.sessionId ?? generateSessionId(),
      type: this.classifyEventType(event),
      content: this.extractContent(event),
      summary: this.generateSummary(event),
      tags: this.extractTags(event),
      classification: this.classify(event),
      importance: this.calculateImportance(event),
      sensitivity: 'public',
      relationships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
      status: 'active',
      embedding: null,
      embeddingModel: null,
      embeddingDimensions: 0,
      source: this.id,
      sourceEventId: event.id ?? null,
      version: 1,
      metadata: {
        agent: { id: this.id, name: this.name, version: this.version },
        project: { name: '', path: '' },
        event: { type: event.type },
        temporal: { sessionStart: new Date(), sequenceNumber: 0 },
      },
    };
  }

  async *streamEvents(): AsyncIterable<AgentEvent> {
    if (!this.watcher) {
      return;
    }

    for await (const event of this.watcher) {
      yield event;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config?.enabled) {
      return { status: 'inactive', message: 'Connector disabled' };
    }

    try {
      // Check if session path exists and is accessible
      const exists = await fs.access(this.config.sessionPath).then(() => true).catch(() => false);
      return exists
        ? { status: 'healthy', message: 'Connected' }
        : { status: 'error', message: `Session path not found: ${this.config.sessionPath}` };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async shutdown(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private setupWatcher(): void {
    // Implement file watching logic
  }

  private classifyEventType(event: AgentEvent): MemoryType {
    // Map agent event types to memory types
    switch (event.type) {
      case 'decision':
        return 'decision';
      case 'error':
        return 'lesson';
      case 'pattern':
        return 'procedural';
      default:
        return 'episodic';
    }
  }

  private extractContent(event: AgentEvent): string {
    // Extract human-readable content from event
    return JSON.stringify(event.payload);
  }

  private generateSummary(event: AgentEvent): string {
    // Generate a one-line summary
    return `${event.type}: ${this.extractContent(event).slice(0, 100)}`;
  }

  private extractTags(event: AgentEvent): string[] {
    // Extract classification tags
    return [event.type];
  }

  private classify(event: AgentEvent): Classification {
    // Classify the event
    return {
      categories: [],
      subcategories: [],
      confidence: 0.5,
      classifier: '<agent-name>-connector',
      classifiedAt: new Date(),
    };
  }

  private calculateImportance(event: AgentEvent): number {
    // Calculate importance score
    return 0.5;
  }
}
```

## Step 4: Create Auto-Registration

```typescript
// src/connectors/<agent-name>/index.ts
import { ConnectorRegistry } from '../registry.js';
import { <AgentName>Connector } from './connector.js';

const connector = new <AgentName>Connector();
ConnectorRegistry.getInstance().register(connector);

export { <AgentName>Connector };
```

## Step 5: Add Configuration Schema

```typescript
// src/connectors/<agent-name>/config.ts
import { z } from 'zod';

export const <AgentName>ConfigSchema = z.object({
  enabled: z.boolean().default(false),
  sessionPath: z.string().default('~/.<agent>/sessions'),
  watchMode: z.boolean().default(false),
  pollInterval: z.string().default('30s'),
  ignoredPaths: z.array(z.string()).default([]),
});

export type <AgentName>Config = z.infer<typeof <AgentName>ConfigSchema>;
```

## Step 6: Write Tests

```typescript
// test/integration/connectors/<agent-name>/connector.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { <AgentName>Connector } from '../../../../src/connectors/<agent-name>/connector.js';

describe('<AgentName>Connector', () => {
  let connector: <AgentName>Connector;

  beforeEach(() => {
    connector = new <AgentName>Connector();
  });

  describe('initialize', () => {
    it('should initialize with valid config', async () => {
      await connector.initialize({
        enabled: true,
        sessionPath: '/tmp/test-sessions',
        watchMode: false,
        pollInterval: '30s',
      });

      const health = await connector.healthCheck();
      expect(health.status).toBeDefined();
    });

    it('should reject config without sessionPath', async () => {
      await expect(
        connector.initialize({ enabled: true, sessionPath: '', watchMode: false, pollInterval: '30s' })
      ).rejects.toThrow();
    });
  });

  describe('captureEvent', () => {
    it('should translate agent event to memory record', async () => {
      await connector.initialize({
        enabled: true,
        sessionPath: '/tmp/test',
        watchMode: false,
        pollInterval: '30s',
      });

      const event = {
        type: 'file_edit',
        payload: { file: 'test.ts', changes: 10 },
        sessionId: 'sess-123',
      };

      const memory = await connector.captureEvent(event);

      expect(memory.agentId).toBe('<agent-name>');
      expect(memory.type).toBe('episodic');
      expect(metadata.agent.id).toBe('<agent-name>');
    });
  });

  describe('healthCheck', () => {
    it('should return inactive when disabled', async () => {
      await connector.initialize({
        enabled: false,
        sessionPath: '/tmp/test',
        watchMode: false,
        pollInterval: '30s',
      });

      const health = await connector.healthCheck();
      expect(health.status).toBe('inactive');
    });
  });
});
```

## Step 7: Register in Main Entry Point

Add the import to `src/index.ts` or the connector loader:

```typescript
import './connectors/<agent-name>/index.js';
```

## Step 8: Update Documentation

Add an entry to the [Connectors](../../knowledge-base/connectors.md) page and create a connector-specific guide in `guides/connectors/<agent-name>.md`.

## Connector Checklist

- [ ] Connector class implements `Connector` interface
- [ ] Auto-registration in `index.ts`
- [ ] Configuration schema with Zod validation
- [ ] Event parsing and translation to `MemoryRecord`
- [ ] Health check implementation
- [ ] Watch mode support (if applicable)
- [ ] Batch ingestion support
- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation (this guide + connectors page)
- [ ] Example configuration in config reference
