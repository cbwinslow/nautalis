# MCP Server

Nautalis implements a Model Context Protocol (MCP) server, allowing AI agents to interact with Nautalis memory through a standardized interface.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI models to interact with external tools and data sources. It provides a standardized way for agents to:

- Discover available tools
- Call tools with structured inputs
- Receive structured outputs
- Access resources

Nautalis exposes its memory system as MCP tools, so any MCP-compatible agent can query, store, and manage memories.

## Configuration

Enable the MCP server in your config:

```toml
[mcp]
enabled = true
port = 3456
host = "localhost"
```

Or via environment variable:

```bash
export NAUTALIS_MCP_ENABLED=true
export NAUTALIS_MCP_PORT=3456
```

Start the server:

```bash
nautalis server --mcp
```

## Available Tools

### `search_memories`

Search memories using semantic search.

**Input:**
```json
{
  "query": "database migration decisions",
  "type": "decision",
  "limit": 5,
  "minScore": 0.5
}
```

**Output:**
```json
{
  "memories": [
    {
      "id": "mem_abc123",
      "type": "decision",
      "content": "Chose PostgreSQL for team deployment",
      "summary": "PostgreSQL selected for concurrent write support",
      "importance": 0.85,
      "relevance": 0.94,
      "createdAt": "2026-03-15T10:00:00Z"
    }
  ]
}
```

### `store_memory`

Store a new memory.

**Input:**
```json
{
  "agentId": "claude-code",
  "sessionId": "sess_xyz789",
  "type": "decision",
  "content": "Chose PostgreSQL for team deployment",
  "metadata": {
    "project": { "name": "my-app" },
    "event": { "type": "decision" }
  }
}
```

**Output:**
```json
{
  "id": "mem_abc123",
  "status": "stored"
}
```

### `get_context`

Generate context package for a new session.

**Input:**
```json
{
  "query": "implementing user registration",
  "agentId": "claude-code",
  "maxTokens": 4096
}
```

**Output:**
```json
{
  "context": "Based on your memory...",
  "memories": [
    { "id": "mem_abc123", "type": "decision", "relevance": 0.92 }
  ],
  "tokenCount": 1847
}
```

### `get_memory`

Retrieve a specific memory by ID.

**Input:**
```json
{
  "id": "mem_abc123"
}
```

**Output:**
```json
{
  "id": "mem_abc123",
  "type": "decision",
  "content": "Chose PostgreSQL for team deployment",
  "metadata": { ... },
  "relationships": [ ... ],
  "createdAt": "2026-03-15T10:00:00Z"
}
```

### `list_memories`

List memories with filtering.

**Input:**
```json
{
  "type": "decision",
  "since": "7d",
  "limit": 20
}
```

### `delete_memory`

Delete a memory by ID.

**Input:**
```json
{
  "id": "mem_abc123"
}
```

### `link_memories`

Create a relationship between two memories.

**Input:**
```json
{
  "sourceId": "mem_abc123",
  "targetId": "mem_def456",
  "type": "causes",
  "strength": 0.8
}
```

### `get_timeline`

Get a chronological timeline of memories.

**Input:**
```json
{
  "since": "2d",
  "agentId": "claude-code",
  "group": true
}
```

### `ask`

Ask a question using RAG over the memory store.

**Input:**
```json
{
  "question": "What did I decide about authentication?",
  "sources": true
}
```

**Output:**
```json
{
  "answer": "Based on your memory, you made the following decisions...",
  "sources": [
    { "id": "mem_abc123", "type": "decision", "relevance": 0.95 }
  ]
}
```

## How Agents Connect

### Claude Code

Add to your Claude Code project settings:

```json
{
  "mcpServers": {
    "nautalis": {
      "command": "nautalis",
      "args": ["server", "--mcp", "--mcp-port", "3456"]
    }
  }
}
```

### Kilo Code

Kilo Code can connect via MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "nautalis": {
        "url": "http://localhost:3456/mcp"
      }
    }
  }
}
```

### Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": [
    {
      "name": "nautalis",
      "url": "http://localhost:3456/mcp"
    }
  ]
}
```

## Example Integration

### Agent Session Flow

1. **Agent starts a new session**
2. **Agent calls `get_context`** with session description
3. **Nautalis returns relevant memories** from past sessions
4. **Agent uses context** to inform its work
5. **Agent calls `store_memory`** to record decisions and actions
6. **Next agent session** benefits from the accumulated knowledge

### Example: Agent Recording a Decision

```typescript
// Agent decides to use a specific pattern
const result = await mcpClient.callTool('store_memory', {
  agentId: 'my-agent',
  sessionId: currentSessionId,
  type: 'decision',
  content: 'Using repository pattern for data access layer',
  metadata: {
    project: { name: 'my-app', path: '/projects/my-app' },
    event: { type: 'decision', files: ['src/data/repository.ts'] },
    temporal: { sessionStart: new Date(), sequenceNumber: 5 }
  }
});
```

### Example: Agent Querying Past Context

```typescript
// Agent needs context about previous auth work
const context = await mcpClient.callTool('get_context', {
  query: 'authentication implementation patterns',
  agentId: 'my-agent',
  maxTokens: 4096
});

// Use the context to inform current work
console.log(context.context);
// "Based on your memory, here's what's relevant:
//  1. Decision: You chose JWT tokens for auth...
//  2. Lesson: Avoid storing tokens in localStorage...
//  3. Procedural: Auth middleware lives in src/auth/middleware.ts..."
```

## Protocol Details

### Transport

The MCP server uses HTTP with JSON-RPC 2.0:

```
POST http://localhost:3456/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_memories",
    "arguments": { "query": "database migration" }
  }
}
```

### Tool Discovery

Agents discover available tools via the `tools/list` method:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

Response includes all available tools with their input schemas.

### Error Handling

MCP errors follow the JSON-RPC 2.0 spec:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": { "details": "Embedding service unavailable" }
  }
}
```
