# Contributing to Nautalis

Thank you for your interest in contributing to **Nautalis** — the Universal AI Agent Memory & Orchestration Platform. We welcome contributions of all kinds, from bug fixes and new features to documentation improvements and connector integrations.

This guide will help you get started and understand our development workflow.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding Connectors](#adding-connectors)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)
- [Getting Help](#getting-help)

## Code of Conduct

This project adheres to our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@nautalis.dev](mailto:conduct@nautalis.dev).

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest stable)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 20+ (if not using Bun)

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nautalis.git
   cd nautalis
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/nautalis/nautalis.git
   ```

4. **Install dependencies**:
   ```bash
   bun install
   ```

5. **Run the development server**:
   ```bash
   bun run dev
   ```

6. **Verify the setup**:
   ```bash
   bun run typecheck
   bun run lint
   bun run test
   ```

### Project Structure

```
nautalis/
├── src/
│   ├── connectors/     # AI tool integrations
│   ├── memory/         # Memory management system
│   ├── store/          # Storage layer
│   ├── telemetry/      # Observability & tracing
│   └── orchestration/  # Agent orchestration engine
├── docs/               # Documentation
├── tests/              # Test files
├── examples/           # Usage examples
└── docker/             # Docker configurations
```

## Development Workflow

### Branch Naming

Use the following convention for branch names:

```
<type>/<short-description>
```

Types:
- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions or changes
- `chore/` — Maintenance tasks

Examples:
- `feat/slack-connector`
- `fix/memory-leak-store`
- `docs/update-quickstart`

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(connectors): add Linear connector for issue tracking
fix(memory): resolve race condition in vector store writes
docs: update connector development guide
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Adding Connectors

Connectors are the heart of Nautalis. They enable AI agents to interact with external tools and services.

### Step-by-Step Guide

1. **Create an issue** using the [Connector Request template](.github/ISSUE_TEMPLATE/connector_request.md) to discuss your plans.

2. **Create the connector directory**:
   ```bash
   mkdir -p src/connectors/<tool-name>
   ```

3. **Implement the connector interface**:
   ```typescript
   // src/connectors/<tool-name>/index.ts
   import { Connector, ConnectorConfig, MemoryEntry } from "../../types";

   export interface <ToolName>Config extends ConnectorConfig {
     apiKey: string;
     workspace?: string;
   }

   export class <ToolName>Connector implements Connector {
     readonly name = "<tool-name>";
     readonly version = "1.0.0";

     constructor(private config: <ToolName>Config) {}

     async initialize(): Promise<void> {
       // Set up client, validate credentials
     }

     async fetchMemoryEntries(): Promise<MemoryEntry[]> {
       // Fetch data from the tool and convert to memory entries
     }

     async executeAction(action: string, params: Record<string, unknown>): Promise<unknown> {
       // Execute actions on behalf of AI agents
     }

     async destroy(): Promise<void> {
       // Clean up resources
     }
   }
   ```

4. **Add authentication handling**:
   ```typescript
   // src/connectors/<tool-name>/auth.ts
   export async function authenticate(config: <ToolName>Config): Promise<void> {
     // Implement OAuth or API key validation
   }
   ```

5. **Write tests**:
   ```typescript
   // tests/connectors/<tool-name>.test.ts
   import { describe, it, expect, beforeEach } from "bun:test";
   import { <ToolName>Connector } from "../../src/connectors/<tool-name>";

   describe("<ToolName>Connector", () => {
     it("should initialize successfully", async () => {
       // Test implementation
     });
   });
   ```

6. **Document the connector**:
   - Add a README in the connector directory
   - Update the connectors index in `docs/connectors/`
   - Include configuration examples

7. **Register the connector**:
   - Export from `src/connectors/index.ts`
   - Add to the connector registry

### Connector Guidelines

- Always implement the full `Connector` interface
- Handle authentication errors gracefully
- Implement retry logic with exponential backoff
- Respect API rate limits
- Never log sensitive data (API keys, tokens)
- Provide meaningful error messages

## Code Standards

### TypeScript

- Use strict mode (`"strict": true` in tsconfig)
- Prefer interfaces over type aliases for object shapes
- Use explicit return types for public APIs
- Avoid `any` — use `unknown` when type is truly unknown
- Use generics where appropriate for reusable code

### ESLint & Prettier

We use ESLint and Prettier for code quality and formatting:

```bash
# Check for lint issues
bun run lint

# Fix auto-fixable issues
bun run lint:fix

# Format code
bun run format
```

### JSDoc

Document all public APIs with JSDoc comments:

```typescript
/**
 * Creates a new memory entry from the given data source.
 *
 * @param source - The data source to extract memory from
 * @param options - Configuration options for memory extraction
 * @returns A promise that resolves to the created memory entry
 * @throws {ValidationError} If the source data is invalid
 *
 * @example
 * ```typescript
 * const entry = await createMemoryEntry(slackSource, {
 *   includeMetadata: true,
 * });
 * ```
 */
export async function createMemoryEntry(
  source: DataSource,
  options: MemoryOptions,
): Promise<MemoryEntry>;
```

### Naming Conventions

- **Files**: kebab-case (`memory-store.ts`)
- **Classes**: PascalCase (`MemoryStore`)
- **Functions/Variables**: camelCase (`createEntry`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`MemoryEntry`, `ConnectorConfig`)

## Testing

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run specific test file
bun test tests/connectors/slack.test.ts
```

### Writing Tests

- Place tests in `tests/` mirroring the `src/` structure
- Use descriptive test names
- Test both success and failure paths
- Mock external API calls
- Use fixtures for test data

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ provider: "memory" });
  });

  it("should store and retrieve entries", async () => {
    const entry = { id: "1", content: "test", source: "manual" };
    await store.put(entry);
    const retrieved = await store.get("1");
    expect(retrieved).toEqual(entry);
  });

  it("should throw on duplicate entries", async () => {
    const entry = { id: "1", content: "test", source: "manual" };
    await store.put(entry);
    await expect(store.put(entry)).rejects.toThrow(DuplicateError);
  });
});
```

## Documentation

Good documentation is essential. When contributing:

- Update relevant docs when changing APIs or behavior
- Add examples for new features
- Keep the README accurate and up to date
- Document breaking changes in CHANGELOG.md

### Building Docs Locally

```bash
bun run docs:dev    # Start docs dev server
bun run docs:build  # Build docs for production
```

### Documentation Structure

```
docs/
├── index.md              # Documentation home
├── getting-started.md    # Quick start guide
├── architecture.md       # System architecture
├── connectors/           # Connector documentation
│   ├── index.md
│   ├── slack.md
│   └── github.md
├── api/                  # API reference
│   ├── memory.md
│   ├── store.md
│   └── orchestration.md
└── guides/               # How-to guides
    ├── adding-connectors.md
    └── deployment.md
```

## Pull Request Process

1. **Ensure your fork is up to date** with the main branch

2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature main
   ```

3. **Make your changes** following our code standards

4. **Run the full test suite**:
   ```bash
   bun run typecheck && bun run lint && bun run test
   ```

5. **Commit your changes** using conventional commits

6. **Push to your fork**:
   ```bash
   git push origin feat/your-feature
   ```

7. **Open a Pull Request** against the `main` branch:
   - Use the PR template
   - Link related issues
   - Provide clear description of changes
   - Add screenshots/recordings for UI changes

8. **Address review feedback** promptly

9. **Squash and merge** once approved (maintainers will handle this)

### PR Requirements

- All CI checks must pass
- At least one maintainer approval
- No merge conflicts with target branch
- Documentation updated if applicable
- Tests added for new functionality

## Community Guidelines

### Be Respectful

- Treat everyone with respect and kindness
- Be constructive in criticism
- Welcome newcomers and help them get started
- Assume good intentions

### Communication

- Use GitHub Issues for bug reports and feature requests
- Use GitHub Discussions for questions and general conversation
- Use Discord/Slack (if available) for real-time chat

### Reporting Issues

- Search existing issues before creating a new one
- Use the appropriate issue template
- Provide as much context as possible
- Be responsive to follow-up questions

### Recognizing Contributions

All contributors are recognized in:
- The project README
- Release notes
- The [CONTRIBUTORS](./CONTRIBUTORS.md) file

## Getting Help

- **Documentation**: [docs.nautalis.dev](https://docs.nautalis.dev)
- **GitHub Discussions**: [github.com/nautalis/nautalis/discussions](https://github.com/nautalis/nautalis/discussions)
- **Email**: [contributors@nautalis.dev](mailto:contributors@nautalis.dev)
- **Issues**: [github.com/nautalis/nautalis/issues](https://github.com/nautalis/nautalis/issues)

Thank you for contributing to Nautalis!
