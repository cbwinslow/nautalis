# Nautalis — Project Rules & Conventions

This document defines the rules, conventions, and standards for all contributions to the Nautalis project. All contributors (human and AI) must follow these rules.

## Code Style

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "target": "ES2022",
    "module": "ESNext",
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

### ESLint Rules

- **Parser**: `@typescript-eslint/parser`
- **Plugin**: `@typescript-eslint/eslint-plugin`
- **Config**: Strict TypeScript recommended rules

Key rules enforced:
```javascript
{
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'prefer-const': 'error',
  'eqeqeq': ['error', 'always'],
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Naming Conventions

| Element | Convention | Example | Rationale |
|---------|-----------|---------|-----------|
| Source files | kebab-case | `memory-engine.ts` | URL-safe, filesystem compatible |
| Test files | `*.test.ts` | `memory-engine.test.ts` | Vitest convention |
| Interfaces | PascalCase | `MemoryRecord`, `Connector` | TypeScript standard |
| Classes | PascalCase | `MemoryEngine`, `SQLiteStore` | TypeScript standard |
| Functions | camelCase | `createMemory`, `enrichContent` | JavaScript standard |
| Variables | camelCase | `memoryCount`, `agentId` | JavaScript standard |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` | Distinguish from variables |
| Enums (type) | PascalCase | `MemoryStatus`, `ConnectorState` | TypeScript standard |
| Enum values | UPPER_SNAKE_CASE | `MemoryStatus.ACTIVE` | Clarity |
| Private members | camelCase with `_` prefix | `_internalState` | Indicate privacy |
| Type parameters | PascalCase, single letter or descriptive | `T`, `TMemory`, `TConfig` | Generic convention |

### Import Order

Imports must be ordered and separated by blank lines:

```typescript
// 1. Node.js built-in modules
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// 2. External dependencies
import { trace } from '@opentelemetry/api';
import { VectorStoreIndex } from 'llamaindex';

// 3. Internal modules (absolute paths)
import { MemoryEngine } from '@/memory/engine.js';
import { ConnectorRegistry } from '@/connectors/registry.js';

// 4. Relative imports
import { validateMemory } from './validator.js';
import type { MemoryRecord } from './types.js';
```

### Code Organization

- **Maximum file length**: 400 lines (excluding tests and types)
- **Maximum function length**: 50 lines
- **Maximum nesting depth**: 3 levels
- **One primary export per file** — Files should have a single responsibility
- **Named exports only** — No `export default`
- **Type-only imports** — Use `import type` when only importing types

```typescript
// Good
import type { MemoryRecord } from './types.js';
import { validateMemory } from './validator.js';

// Bad
import { MemoryRecord, validateMemory } from './types.js';
```

## Git Conventions

### Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(connectors): add Windsurf connector` |
| `fix` | Bug fix | `fix(memory): resolve embedding race condition` |
| `docs` | Documentation only | `docs(agents): update connector interface docs` |
| `style` | Code style (no logic change) | `style: apply prettier formatting` |
| `refactor` | Code restructuring (no behavior change) | `refactor(store): extract storage interface` |
| `perf` | Performance improvement | `perf(embeddings): batch embedding generation` |
| `test` | Test additions or modifications | `test(connectors): add integration tests for Claude` |
| `build` | Build system changes | `build: update Bun dependency to 1.2` |
| `ci` | CI configuration changes | `ci: add coverage reporting to GitHub Actions` |
| `chore` | Maintenance tasks | `chore: clean up unused dependencies` |
| `revert` | Reverting a commit | `revert: feat(connectors): add Windsurf connector` |

#### Scopes

Use these scopes to identify the affected area:

- `connectors` — Connector system
- `memory` — Memory engine
- `store` — Storage layer
- `telemetry` — OpenTelemetry instrumentation
- `orchestration` — Orchestration intelligence
- `cli` — Command-line interface
- `tui` — Terminal user interface
- `api` — REST API / MCP server
- `config` — Configuration
- `deps` — Dependencies
- `docs` — Documentation
- `ci` — CI/CD

#### Commit Message Rules

- **Subject line**: Maximum 72 characters
- **Imperative mood**: "add" not "added" or "adds"
- **No period** at the end of the subject line
- **Body**: Explain what and why, not how (wrap at 72 characters)
- **Breaking changes**: Include `BREAKING CHANGE:` in footer with description

```
feat(memory): add automatic PII detection and redaction

Memory enrichment now scans all content for personally identifiable
information before storage. Detected PII is redacted and the original
is stored encrypted separately with access controls.

BREAKING CHANGE: MemoryRecord interface now requires piiScan field
in metadata. All existing memories will be backfilled on next startup.
```

### Branch Naming

```
<type>/<short-description>

# Examples
feature/add-windsurf-connector
bugfix/embedding-race-condition
refactor/extract-storage-interface
docs/update-agent-instructions
perf/batch-embedding-generation
```

#### Branch Type Rules

| Prefix | Purpose |
|--------|---------|
| `feature/` | New features |
| `bugfix/` | Bug fixes |
| `hotfix/` | Urgent production fixes |
| `refactor/` | Code restructuring |
| `docs/` | Documentation changes |
| `test/` | Test additions |
| `perf/` | Performance improvements |
| `chore/` | Maintenance tasks |
| `release/` | Release preparation |

### Pull Request Requirements

Every PR must include:

1. **Descriptive title** following conventional commit format
2. **Description** explaining:
   - What changed
   - Why it changed
   - How to verify the change
3. **Linked issues** — Reference related issues with `Closes #123` or `Fixes #123`
4. **Tests** — All new/modified code must have tests
5. **Documentation** — Update relevant docs for user-facing changes
6. **Changelog entry** — For user-facing changes

#### PR Template

```markdown
## Summary
<!-- 1-3 bullet points describing the change -->

## Changes
<!-- Detailed list of changes -->

## Testing
<!-- How to verify the changes -->

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Conventional commit message
- [ ] No new dependencies (or justified)
- [ ] Security review completed (if applicable)
```

### Merge Strategy

- **Squash and merge** for feature branches (clean history)
- **Rebase and merge** for small fixes
- **Merge commit** for release branches

## Documentation Requirements

### JSDoc for All Public Functions

Every exported function, class, and interface must have JSDoc:

```typescript
/**
 * Stores a new memory record in the memory engine.
 *
 * Enriches the memory with embeddings, classification, and relationship
 * extraction before persisting to the configured storage backend.
 *
 * @param params - The memory creation parameters
 * @param params.content - The memory content to store
 * @param params.metadata - Required metadata including agent identity
 * @param options - Optional storage configuration
 * @param options.skipEmbedding - Skip embedding generation (default: false)
 * @returns The stored memory record with generated ID and timestamps
 * @throws {MemoryValidationError} If required metadata is missing
 * @throws {EmbeddingError} If embedding generation fails
 * @throws {StorageError} If persistence fails
 *
 * @example
 * ```typescript
 * const memory = await engine.store({
 *   content: 'Discovered auth pattern in src/auth.ts',
 *   metadata: {
 *     agentId: 'kilo-code',
 *     agentType: 'kilo-code',
 *     projectId: 'my-project',
 *     category: 'discovery',
 *   },
 * });
 * ```
 */
export async function store(
  params: CreateMemoryParams,
  options: StoreOptions = {}
): Promise<MemoryRecord> {
  // implementation
}
```

### README Updates

Update README.md when:
- Adding new features (document usage)
- Changing configuration options (update config docs)
- Adding new connectors (update connector list)
- Changing installation or setup steps

### Inline Comments

- **Why, not what** — Comments should explain reasoning, not restate code
- **TODO format** — `TODO(<scope>): description` with optional issue reference
- **FIXME format** — `FIXME(<scope>): description` for known issues
- **HACK format** — `HACK(<scope>): description` for workarounds

```typescript
// TODO(connectors): Support WebSocket streaming for real-time events
// FIXME(memory): Race condition when concurrent embeddings are generated
// HACK(store): Workaround for SQLite concurrent write limitation
```

## Testing Requirements

### Coverage Targets

| Module Type | Minimum Coverage |
|-------------|-----------------|
| Core engine | 90% |
| Connectors | 85% |
| Storage | 90% |
| Telemetry | 80% |
| Utilities | 95% |

### Test Types

#### Unit Tests

- Test individual functions and classes in isolation
- Mock all external dependencies
- Fast execution (< 100ms per test)
- Location: `test/unit/`

#### Integration Tests

- Test interactions between modules
- Use real dependencies where possible (SQLite, not mocks)
- Slower but more realistic
- Location: `test/integration/`

#### End-to-End Tests

- Test complete workflows
- Spin up full system (connectors, memory, storage)
- Slowest but most comprehensive
- Location: `test/e2e/`

### Test Conventions

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MemoryEngine', () => {
  let engine: MemoryEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  describe('store', () => {
    it('should store a memory with full metadata', async () => {
      // Arrange
      const memory = createTestMemory();

      // Act
      const result = await engine.store(memory);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.metadata.agentId).toBe(memory.metadata.agentId);
    });

    it('should reject memories without required metadata', async () => {
      const incomplete = { content: 'test' };
      await expect(engine.store(incomplete)).rejects.toThrow(
        MemoryValidationError
      );
    });

    it('should generate embeddings for new memories', async () => {
      const memory = createTestMemory();
      const embedSpy = vi.spyOn(engine, 'generateEmbedding');

      await engine.store(memory);

      expect(embedSpy).toHaveBeenCalledWith(memory.content);
    });
  });
});
```

### Test Data

- Use factories, not fixtures, for test data generation
- Factory location: `test/factories/`
- Shared fixtures: `test/fixtures/`

```typescript
// test/factories/memory.ts
export function createTestMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: crypto.randomUUID(),
    agentId: 'test-agent',
    agentType: 'test',
    content: 'Test memory content',
    metadata: {
      projectId: 'test-project',
      category: 'test',
      tags: ['test'],
      confidence: 1.0,
      importance: 'medium',
      sensitivity: 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    },
    ...overrides,
  };
}
```

## Dependency Rules

### Allowed Dependencies

- **Must be free and open-source** (MIT, Apache 2.0, BSD, ISC licenses)
- **No copyleft licenses** (GPL, AGPL) for core dependencies
- **Actively maintained** — Last commit within 6 months, or stable/mature
- **Security audited** — No known critical vulnerabilities

### Prohibited Dependencies

- Paid or commercial-only packages
- Packages with known critical CVEs
- Packages with copyleft licenses (for core dependencies)
- Packages with suspicious or obfuscated code
- Packages with excessive permissions in package.json

### Adding Dependencies

Before adding a new dependency:

1. **Check if it's necessary** — Can existing dependencies cover this?
2. **Verify license** — Must be MIT, Apache 2.0, BSD, or ISC
3. **Check maintenance** — Recent commits, active issues resolution
4. **Run security audit** — `bun audit` or `npm audit`
5. **Document the addition** — Include reason in PR description
6. **Prefer smaller packages** — Minimize bundle size and attack surface

### Dependency Updates

- **Patch updates** — Auto-merge if tests pass
- **Minor updates** — Review changelog, update if no breaking changes
- **Major updates** — Careful review, test thoroughly, update documentation

## Security Rules

### Secrets Management

- **No hardcoded secrets** — Use environment variables or config files
- **No secrets in git** — Pre-commit hook scans for secrets
- **`.env` files** — Listed in `.gitignore`, never committed
- **`.env.example`** — Template with placeholder values, committed to repo

```bash
# .env.example
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=sqlite://./nautalis.db
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Secret Scanning

Pre-commit hook runs secret detection:

```bash
# hooks/pre-commit
#!/bin/bash
# Scan for potential secrets
npx detect-secrets scan --baseline .secrets.baseline
```

Patterns scanned:
- AWS access keys
- API keys (OpenAI, Anthropic, etc.)
- Private keys (RSA, EC, etc.)
- Database connection strings with passwords
- JWT secrets
- Generic high-entropy strings

### PII Detection

Memory content is scanned for PII before storage:

```typescript
// Detected patterns
const PII_PATTERNS = [
  /email/i,           // Email addresses
  /phone/i,           // Phone numbers
  /ssn/i,             // Social security numbers
  /credit.?card/i,    // Credit card numbers
  /password/i,        // Passwords
  /api.?key/i,        // API keys
  /token/i,           // Tokens
];
```

PII handling:
1. **Detect** — Scan content against PII patterns
2. **Redact** — Replace PII with `[REDACTED]` in main storage
3. **Encrypt** — Store original PII separately with encryption
4. **Audit** — Log PII detection events for compliance

### Input Validation

- **Validate all external input** — CLI args, API requests, connector events
- **Sanitize file paths** — Prevent path traversal attacks
- **Limit payload sizes** — Prevent memory exhaustion
- **Rate limit API endpoints** — Prevent abuse

```typescript
// Payload size limits
const MAX_MEMORY_CONTENT_SIZE = 100_000; // 100KB
const MAX_BATCH_SIZE = 100; // memories per batch
const MAX_QUERY_LENGTH = 10_000; // characters
```

### Security Headers (API)

```typescript
// Hono middleware for security headers
app.use('*', async (ctx, next) => {
  ctx.header('X-Content-Type-Options', 'nosniff');
  ctx.header('X-Frame-Options', 'DENY');
  ctx.header('X-XSS-Protection', '1; mode=block');
  ctx.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  await next();
});
```

## Review Process

### Code Review Requirements

- **At least one approval** required before merge
- **Reviewer must not be the author** — No self-approvals
- **All CI checks must pass** — Tests, linting, type checking
- **All comments must be resolved** — Or explicitly acknowledged

### Review Checklist

Reviewers should verify:

- [ ] Code follows project conventions (style, naming, organization)
- [ ] Tests cover new functionality and edge cases
- [ ] Documentation is updated (JSDoc, README, etc.)
- [ ] No security issues (secrets, PII, input validation)
- [ ] Performance considerations addressed
- [ ] Error handling is comprehensive
- [ ] Telemetry/instrumentation added for new features
- [ ] Dependencies are justified and audited

### CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      - run: bun test --coverage
      - run: bun audit

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx detect-secrets scan --baseline .secrets.baseline
      - run: npm audit --audit-level=critical
```

### Merge Requirements

Before merging, ensure:

1. All CI checks pass (green)
2. At least one approval from a maintainer
3. All review comments resolved
4. Branch is up to date with main
5. Commit message follows conventional commits
6. No merge conflicts

## Enforcement

### Automated Enforcement

| Rule | Enforced By |
|------|-------------|
| TypeScript strict mode | `tsc --noEmit` in CI |
| ESLint rules | `bun run lint` in CI |
| Prettier formatting | `bun run format:check` in CI |
| Test coverage | `bun test --coverage` in CI |
| Secret scanning | Pre-commit hook |
| Conventional commits | Commitlint in CI |
| Dependency audit | `bun audit` in CI |

### Manual Enforcement

| Rule | Enforced By |
|------|-------------|
| Code review quality | Maintainer review |
| Documentation completeness | Reviewer checklist |
| Security considerations | Security review |
| Architecture decisions | Maintainer approval |

### Violations

- **CI failures** — Block merge until resolved
- **Convention violations** — Request changes in review
- **Security violations** — Block merge, require security review
- **Repeated violations** — Discussion with maintainers
