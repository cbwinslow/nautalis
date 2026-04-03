# Context Injection Guide

Inject relevant memories into AI agent sessions so no agent ever starts from zero.

## How It Works

Context injection is the process of retrieving relevant memories and formatting them for an AI agent's system prompt or context window.

```
New Session ──→ Context Service ──→ RAG Retrieval ──→ Synthesis ──→ Agent
     │                │                   │                │
     │                │                   │                │
     ▼                ▼                   ▼                ▼
  Session info    Build query       Vector search    Format context
  + description   + filters         + metadata       for agent model
```

## Manual Context Generation

```bash
# Generate context for a session
nautalis context --query "implementing user registration with email verification"

# Scope to specific agent
nautalis context --query "auth module refactoring" --agent claude-code

# Control context size
nautalis context --query "database migration" --max-tokens 2048

# Output as JSON for programmatic use
nautalis context --query "API design patterns" --format json

# Output as markdown
nautalis context --query "testing strategy" --format markdown
```

**Output:**
```
Context for: "implementing user registration with email verification"

=== Relevant Memories (7 found, 1,847 tokens) ===

[DECISION] Chose JWT tokens for authentication (Relevance: 0.92)
  Agent: claude-code | 2026-03-15
  We decided to use JWT tokens over session-based auth because they're
  stateless and work well with our microservices architecture.

[LESSON] Don't store tokens in localStorage (Relevance: 0.87)
  Agent: kilo-code | 2026-03-16
  Learned that storing JWT tokens in localStorage is vulnerable to XSS.
  Use httpOnly cookies instead.

[PROCEDURAL] Auth middleware location (Relevance: 0.82)
  Agent: claude-code | 2026-03-15
  Auth middleware lives in src/auth/middleware.ts. It validates JWT
  tokens and attaches user info to the request object.

[DECISION] Email verification flow (Relevance: 0.78)
  Agent: claude-code | 2026-03-20
  Using SendGrid for email delivery. Verification tokens expire after 24h.
  Users can request a new verification email.

[SEMANTIC] User schema fields (Relevance: 0.75)
  Agent: kilo-code | 2026-03-15
  User table: id, email, password_hash, email_verified, created_at,
  updated_at. Email must be unique and lowercase.

[LESSON] Rate limit registration (Relevance: 0.68)
  Agent: claude-code | 2026-03-22
  Registration endpoint needs rate limiting to prevent abuse.
  Use sliding window with max 5 registrations per IP per hour.

[PREFERENCE] Error message format (Relevance: 0.55)
  Agent: kilo-code | 2026-03-18
  Prefer descriptive error messages: "Email already registered"
  instead of generic "Validation failed".
```

## Automatic Context Injection

### Via MCP Server

When an MCP-compatible agent starts a session, it can request context:

```typescript
// Agent requests context
const context = await mcpClient.callTool('get_context', {
  query: 'implementing user registration',
  agentId: 'my-agent',
  maxTokens: 4096,
});

// Use context in system prompt
const systemPrompt = `
You are working on the my-app project.

Here is relevant context from previous sessions:
${context.context}

Proceed with the task using this context.
`;
```

### Via REST API

```bash
curl -X POST http://localhost:3000/api/v1/context \
  -H "Authorization: Bearer $NAUTALIS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "implementing user registration",
    "agentId": "claude-code",
    "maxTokens": 4096,
    "maxMemories": 10
  }'
```

## Context Synthesis

The synthesis engine combines retrieved memories into a coherent context package:

### Relevance Scoring

Memories are scored on multiple signals:

```typescript
function calculateRelevance(memory: MemoryRecord, query: string): number {
  let score = 0;

  // Vector similarity (primary signal)
  score += memory.vectorSimilarity * 0.5;

  // Recency bonus
  const ageDays = daysSince(memory.createdAt);
  score += Math.max(0, 0.2 - ageDays * 0.005);

  // Importance bonus
  score += memory.importance * 0.2;

  // Type bonus (decisions and lessons are more actionable)
  if (memory.type === 'decision') score += 0.1;
  if (memory.type === 'lesson') score += 0.1;

  // Same agent bonus
  if (memory.agentId === query.agentId) score += 0.05;

  // Sensitivity filter
  if (memory.sensitivity === 'secret') return 0;
  if (memory.sensitivity === 'private' && memory.agentId !== query.agentId) return 0;

  return Math.min(score, 1.0);
}
```

### Context Formatting

Context is formatted based on the output format:

**Text format (default):**
```
Based on your memory, here's what's relevant:

1. **Decision**: Chose JWT tokens for authentication
   Agent: claude-code | March 15
   We decided to use JWT tokens over session-based auth...

2. **Lesson**: Don't store tokens in localStorage
   Agent: kilo-code | March 16
   Learned that storing JWT tokens in localStorage...
```

**JSON format:**
```json
{
  "context": "formatted text...",
  "memories": [
    { "id": "mem_abc", "type": "decision", "relevance": 0.92, "content": "..." }
  ],
  "tokenCount": 1847
}
```

**Markdown format:**
```markdown
# Context: Implementing User Registration

## Decisions
- **JWT tokens** — Chosen for stateless auth (claude-code, Mar 15)

## Lessons
- **No localStorage for tokens** — XSS vulnerability (kilo-code, Mar 16)

## Procedures
- **Auth middleware** — Located at `src/auth/middleware.ts`
```

## Configuration

```toml
[orchestration]
contextInjection = true           # Enable/disable context injection
maxContextSize = 4096             # Max tokens per context
maxContextMemories = 10           # Max memories per context
relevanceThreshold = 0.5          # Minimum relevance score

[memory]
defaultTTL = "90d"                # Episodic memory TTL
importanceThreshold = 0.3         # Min importance for retention
enableDecay = true                # Enable importance decay
decayRate = 0.01                  # Daily decay rate
```

## Sensitivity Filtering

Context injection respects sensitivity levels:

| Level | Injected To |
|-------|-------------|
| `public` | All agents, all sessions |
| `internal` | Same team members only |
| `private` | Only the creating agent |
| `secret` | Never injected |

## Best Practices

### Query Specificity

More specific queries yield more relevant context:

```bash
# Too broad — returns everything
nautalis context --query "code"

# Better — scoped to domain
nautalis context --query "authentication implementation"

# Best — includes project context
nautalis context --query "user registration email verification my-api"
```

### Context Size Management

Balance context richness with token budget:

- **Small models (8K context):** `--max-tokens 2048`
- **Medium models (32K context):** `--max-tokens 4096`
- **Large models (128K+ context):** `--max-tokens 8192`

### Pre-Session Context

Generate context before starting an agent session:

```bash
# Generate and save context
nautalis context --query "refactoring the payment module" --format json > context.json

# Pass to agent (example with Claude Code)
claude --system-prompt "$(cat context.json | jq -r '.context')"
```
