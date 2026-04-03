# Memory Schema

Nautalis uses a rich, structured memory model. Every memory is a fully-typed record with mandatory metadata — no partial records allowed.

## Full Schema

```typescript
export interface MemoryRecord {
  // Identity
  id: string;                    // UUID v4
  agentId: string;               // Source agent identifier
  sessionId: string;             // Session this memory belongs to

  // Content
  type: MemoryType;              // episodic | semantic | procedural | decision | lesson | preference
  content: string;               // The memory content (text)
  summary: string;               // Auto-generated summary
  tags: string[];                // Classification tags

  // Metadata
  metadata: MemoryMetadata;      // Rich metadata object
  classification: Classification; // Auto-assigned classification
  importance: number;            // Importance score (0.0 - 1.0)
  sensitivity: SensitivityLevel; // public | internal | private | secret

  // Relationships
  relationships: MemoryRelationship[]; // Links to related memories

  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;        // TTL expiration (null = permanent)
  status: MemoryStatus;          // active | archived | expired | deleted

  // Embeddings
  embedding: number[] | null;    // Vector embedding (nullable until generated)
  embeddingModel: string | null; // Model used for embedding
  embeddingDimensions: number;   // Dimension count of embedding

  // Provenance
  source: string;                // Connector ID that created this
  sourceEventId: string | null;  // Original event ID
  version: number;               // Schema version
}
```

## Memory Types

| Type | Description | Example | Retention |
|------|-------------|---------|-----------|
| **episodic** | Specific events that occurred | "Claude refactored auth module at 2pm" | 90 days |
| **semantic** | Factual knowledge about the codebase | "The auth module uses JWT tokens" | Permanent |
| **procedural** | How-to knowledge, patterns | "Run migrations with `bun run migrate`" | Permanent |
| **decision** | Decisions made with rationale | "Chose PostgreSQL over SQLite for team deployment" | Permanent |
| **lesson** | Lessons learned from mistakes | "Don't use raw SQL for user queries — use parameterized" | Permanent |
| **preference** | User or team preferences | "Prefer functional components over classes" | Until changed |

## Classification System

Memories are automatically classified using a multi-label system:

```typescript
export interface Classification {
  categories: string[];          // Primary categories (e.g., "auth", "database", "api")
  subcategories: string[];       // Sub-categories (e.g., "jwt", "postgresql", "rest")
  confidence: number;            // Classification confidence (0.0 - 1.0)
  classifier: string;            // Classifier that assigned this
  classifiedAt: Date;            // When classification occurred
}
```

**Category taxonomy:**

```
nautalis/
├── code/
│   ├── architecture/
│   ├── patterns/
│   ├── refactoring/
│   └── bugs/
├── decisions/
│   ├── technology/
│   ├── design/
│   └── process/
├── knowledge/
│   ├── domain/
│   ├── infrastructure/
│   └── tooling/
├── communication/
│   ├── team/
│   └── external/
└── meta/
    ├── system/
    └── configuration/
```

## Memory Metadata

```typescript
export interface MemoryMetadata {
  // Agent context
  agent: {
    id: string;
    name: string;
    version: string;
    model?: string;
  };

  // Project context
  project: {
    name: string;
    path: string;
    branch?: string;
    commit?: string;
  };

  // Event context
  event: {
    type: string;              // tool_call, file_edit, command, error, decision
    tool?: string;             // Tool name if applicable
    files?: string[];          // Affected files
    duration?: number;         // Operation duration in ms
    error?: string;            // Error message if applicable
  };

  // Temporal context
  temporal: {
    sessionStart: Date;
    sessionDuration?: number;
    sequenceNumber: number;    // Order within session
  };

  // Custom metadata (connector-specific)
  custom?: Record<string, unknown>;
}
```

## Relationship Graph

Memories form a directed graph through explicit relationships:

```typescript
export interface MemoryRelationship {
  targetId: string;            // ID of the related memory
  type: RelationshipType;      // Type of relationship
  strength: number;            // Relationship strength (0.0 - 1.0)
  createdAt: Date;
}

export type RelationshipType =
  | 'caused_by'        // This memory was caused by the target
  | 'causes'           // This memory causes the target
  | 'related_to'       // General relation
  | 'contradicts'      // This memory contradicts the target
  | 'refines'          // This memory refines the target
  | 'supersedes'       // This memory replaces the target
  | 'depends_on'       // This memory depends on the target
  | 'implements'       // This memory implements a decision
  | 'learned_from'     // This lesson was learned from the target event
  | 'same_session'     // Both memories from the same session
  | 'same_topic'       // Both memories about the same topic
  | 'same_file'        // Both memories reference the same file
;
```

**Example relationship chain:**

```
Decision: "Use PostgreSQL" (id: abc123)
  └── implements → Decision: "Need multi-user support" (id: def456)
  └── causes → Procedural: "Set up connection pooling" (id: ghi789)
  └── learned_from → Lesson: "SQLite locks under concurrent writes" (id: jkl012)
```

## Lifecycle Management

### TTL (Time-To-Live)

Memories can have expiration dates:

| Memory Type | Default TTL | Rationale |
|-------------|-------------|-----------|
| episodic | 90 days | Events lose relevance over time |
| semantic | None (permanent) | Facts remain useful |
| procedural | None (permanent) | How-to knowledge persists |
| decision | None (permanent) | Decisions are historical record |
| lesson | None (permanent) | Lessons are always valuable |
| preference | Until superseded | Preferences change over time |

### Importance Scoring

Importance is calculated from multiple signals:

```typescript
function calculateImportance(memory: MemoryRecord): number {
  let score = 0.5; // Base score

  // Decision memories are important
  if (memory.type === 'decision') score += 0.2;

  // Errors and lessons are important
  if (memory.type === 'lesson') score += 0.15;
  if (memory.metadata.event.error) score += 0.1;

  // Files touched in many memories are important
  const fileCount = memory.metadata.event.files?.length ?? 0;
  score += Math.min(fileCount * 0.05, 0.15);

  // Recent memories get slight boost
  const ageDays = daysSince(memory.createdAt);
  if (ageDays < 1) score += 0.05;

  return Math.min(score, 1.0);
}
```

### Decay

Episodic memories decay over time:

```typescript
function applyDecay(memory: MemoryRecord): number {
  if (memory.type !== 'episodic') return memory.importance;

  const ageDays = daysSince(memory.createdAt);
  const decayRate = 0.01; // 1% per day
  const decayed = memory.importance * Math.exp(-decayRate * ageDays);

  return Math.max(decayed, 0.1); // Floor at 0.1
}
```

### Staleness Detection

Memories can become stale when superseded:

```typescript
function detectStaleness(memory: MemoryRecord, allMemories: MemoryRecord[]): StalenessStatus {
  // Check if any memory supersedes this one
  const superseding = allMemories.filter(
    m => m.relationships.some(r => r.targetId === memory.id && r.type === 'supersedes')
  );

  if (superseding.length > 0) return 'superseded';

  // Check if content references outdated patterns
  if (isOutdatedPattern(memory.content)) return 'outdated';

  return 'current';
}
```

## Sensitivity Levels

| Level | Description | Visibility |
|-------|-------------|------------|
| **public** | Safe to share with any agent | All agents, all sessions |
| **internal** | Team-internal knowledge | Same team members only |
| **private** | Personal context | Only the creating agent |
| **secret** | Sensitive information (credentials, keys) | Never injected, stored encrypted |

**Security rules:**
- `secret` memories are never injected into agent context
- `private` memories are only injected to the same agent that created them
- `internal` memories respect team boundaries
- `public` memories are available to all agents
