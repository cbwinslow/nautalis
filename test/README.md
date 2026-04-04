# Test Directory Structure

This directory contains all test files for Nautalis.

## Structure

````
test/
├── unit/              # Unit tests - test individual functions/classes in isolation
│   ├── store/
│   │   └── postgres.store.test.ts
│   ├── memory/
│   │   ├── engine.test.ts
│   │   ├── classify.test.ts
│   │   └── extract.test.ts
│   ├── connectors/
│   │   ├── registry.test.ts
│   │   ├── base.test.ts
│   │   ├── claude-code.test.ts
│   │   ├── kilo-code.test.ts
│   │   └── filesystem.test.ts
│   ├── telemetry/
│   │   ├── provider.test.ts
│   │   └── benchmark.test.ts
│   └── config/
│       └── loader.test.ts
├── integration/       # Integration tests - test interactions between modules
│   ├── store-memory.test.ts
│   ├── rag-retrieval.test.ts
│   ├── permissions-rls.test.ts
│   └── team-isolation.test.ts
├── e2e/              # End-to-end tests - complete workflows
│   ├── init-flow.test.ts
│   ├── ingest-search-flow.test.ts
│   ├── team-kb-flow.test.ts
│   └── permissions-flow.test.ts
├── factories/        # Test data factories
│   ├── memory.ts
│   ├── user.ts
│   ├── team.ts
│   ├── agent.ts
│   ├── event.ts
│   └── index.ts
├── fixtures/         # Shared test fixtures (static data)
│   ├── connections.ts
│   ├── configs.ts
│   └── embeddings.ts
└── helpers.ts        # Test utilities and helpers

## Running Tests

```bash
# All tests
bun test

# Watch mode
bun test --watch

# With coverage
bun test --coverage

# Specific file
bun test test/unit/store/postgres.store.test.ts

# With verbose output
bun test --verbose
````

## Writing Tests

All tests use Bun's built-in test runner with Vitest-style API:

```typescript
import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { PostgresStore } from '@/store/postgres/store.js';

describe('PostgresStore', () => {
  let store: PostgresStore;

  beforeEach(() => {
    // Setup before each test
    store = new PostgresStore('postgresql://test:test@localhost:5432/test');
  });

  it('should create a user', async () => {
    const user = await store.createUser({ email: 'test@example.com' });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });

  it('should reject invalid email', async () => {
    await expect(store.createUser({ email: 'invalid' })).rejects.toThrow();
  });
});
```

## Coverage Targets

| Module Type | Minimum Coverage |
| ----------- | ---------------- |
| Core engine | 90%              |
| Connectors  | 85%              |
| Storage     | 90%              |
| Telemetry   | 80%              |
| Utilities   | 95%              |

## Test Database

Integration tests require a PostgreSQL database. Use the test Docker compose:

```bash
docker compose -f docker/docker-compose.test.yml up -d
```

Tests will automatically connect to `postgresql://test:test@localhost:5433/nautalis_test`.
