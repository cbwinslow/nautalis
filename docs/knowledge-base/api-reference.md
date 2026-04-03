# REST API Reference

Nautalis exposes a REST API built with Hono for programmatic access to memories, context, and system management.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer $NAUTALIS_API_TOKEN" http://localhost:3000/api/v1/memories
```

Configure the token via `NAUTALIS_API_AUTH_TOKEN` environment variable or `api.authToken` in config.

## Response Format

All responses follow a consistent envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

## Endpoints

### Events

#### List Events

```
GET /events
```

Query parameters:
| Param | Type | Description |
|-------|------|-------------|
| `agentId` | string | Filter by agent |
| `type` | string | Filter by event type |
| `since` | string | ISO date or duration |
| `limit` | number | Results per page (default: 50) |
| `offset` | number | Pagination offset |

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_abc123",
      "agentId": "claude-code",
      "type": "tool_call",
      "payload": { "tool": "ReadFile", "file": "src/auth.ts" },
      "timestamp": "2026-04-01T14:32:01Z",
      "memoryId": "mem_def456"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 127, "hasMore": true }
}
```

#### Get Event

```
GET /events/:id
```

#### Ingest Event

```
POST /events
```

Request body:
```json
{
  "agentId": "claude-code",
  "type": "file_edit",
  "payload": {
    "file": "src/auth/middleware.ts",
    "operation": "write",
    "linesAdded": 12,
    "linesRemoved": 3
  },
  "timestamp": "2026-04-01T14:32:01Z"
}
```

### Memories

#### List Memories

```
GET /memories
```

Query parameters:
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by memory type |
| `agentId` | string | Filter by agent |
| `classification` | string | Filter by classification |
| `since` | string | Filter by date range |
| `importance` | number | Minimum importance |
| `sensitivity` | string | Filter by sensitivity level |
| `limit` | number | Results per page |
| `offset` | number | Pagination offset |

#### Get Memory

```
GET /memories/:id
```

#### Search Memories

```
GET /memories/search
```

Query parameters:
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | Filter by memory type |
| `agentId` | string | Filter by agent |
| `limit` | number | Max results (default: 10) |
| `minScore` | number | Minimum relevance score |

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "mem_abc123",
      "type": "decision",
      "content": "Chose PostgreSQL for team deployment",
      "summary": "PostgreSQL selected for concurrent write support",
      "importance": 0.85,
      "score": 0.94,
      "metadata": {
        "agent": { "id": "claude-code", "name": "Claude Code" },
        "project": { "name": "my-app", "path": "/projects/my-app" }
      },
      "createdAt": "2026-03-15T10:00:00Z"
    }
  ]
}
```

#### Create Memory

```
POST /memories
```

Request body:
```json
{
  "agentId": "claude-code",
  "sessionId": "sess_xyz789",
  "type": "decision",
  "content": "Chose PostgreSQL for team deployment",
  "metadata": {
    "agent": { "id": "claude-code", "name": "Claude Code", "version": "1.0.0" },
    "project": { "name": "my-app", "path": "/projects/my-app" },
    "event": { "type": "decision" },
    "temporal": { "sessionStart": "2026-03-15T09:00:00Z", "sequenceNumber": 1 }
  }
}
```

#### Delete Memory

```
DELETE /memories/:id
```

#### Update Memory

```
PATCH /memories/:id
```

#### Link Memories

```
POST /memories/:id/relationships
```

Request body:
```json
{
  "targetId": "mem_def456",
  "type": "causes",
  "strength": 0.8
}
```

### Context

#### Generate Context

```
POST /context
```

Request body:
```json
{
  "query": "implementing user registration",
  "agentId": "claude-code",
  "project": "/projects/my-app",
  "maxTokens": 4096,
  "maxMemories": 10
}
```

Response:
```json
{
  "success": true,
  "data": {
    "context": "Based on your memory, here's what's relevant:\n\n1. **Decision**: You chose JWT tokens for auth...\n2. **Lesson**: Avoid circular imports in utils/...\n3. **Procedural**: Run migrations with `bun run migrate`...",
    "memories": [
      { "id": "mem_abc123", "type": "decision", "relevance": 0.92 },
      { "id": "mem_def456", "type": "lesson", "relevance": 0.78 }
    ],
    "tokenCount": 1847
  }
}
```

### Sessions

#### List Sessions

```
GET /sessions
```

#### Get Session

```
GET /sessions/:id
```

#### Create Session

```
POST /sessions
```

Request body:
```json
{
  "agentId": "claude-code",
  "project": "/projects/my-app",
  "branch": "feature/auth"
}
```

#### End Session

```
POST /sessions/:id/end
```

### Connectors

#### List Connectors

```
GET /connectors
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "claude-code",
      "name": "Claude Code",
      "version": "1.0.0",
      "status": "active",
      "lastHeartbeat": "2026-04-01T14:30:00Z"
    }
  ]
}
```

#### Get Connector Status

```
GET /connectors/:id/status
```

#### Enable Connector

```
POST /connectors/:id/enable
```

#### Disable Connector

```
POST /connectors/:id/disable
```

### Health

```
GET /health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "storage": { "backend": "sqlite", "status": "connected" },
    "embeddings": { "provider": "ollama", "status": "connected" },
    "connectors": { "active": 2, "total": 3 },
    "uptime": 86400,
    "memoryCount": 1247
  }
}
```

## Error Responses

| Status Code | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (duplicate memory) |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Internal server error |
| 503 | `SERVICE_UNAVAILABLE` | Storage or embedding service unavailable |

Error response format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": ["agentId", "content"],
      "errors": ["agentId is required", "content must not be empty"]
    }
  }
}
```
