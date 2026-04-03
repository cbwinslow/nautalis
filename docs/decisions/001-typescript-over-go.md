# ADR 001: TypeScript over Go

**Status:** Accepted  
**Date:** 2026-01-15  
**Context:** Language selection for Nautalis platform

## Decision

We chose **TypeScript** as the primary language for Nautalis instead of Go.

## Alternatives Considered

1. **Go** — Strong concurrency, single binary, fast execution
2. **Python** — Rich AI/ML ecosystem, LlamaIndex native
3. **Rust** — Maximum performance, memory safety
4. **TypeScript** — Developer experience, ecosystem, AI tool compatibility

## Rationale

### AI Tool Ecosystem Compatibility

The AI coding agents we integrate with (Claude Code, Kilo Code, Cursor, Windsurf) all have first-class TypeScript support. TypeScript is the most common language in their training data and the one they produce the highest quality code in.

### LlamaIndex.TS

LlamaIndex has an official TypeScript port (LlamaIndex.TS) that provides the full RAG pipeline we need. While the Python version is more mature, the TS version is actively maintained and sufficient for our use case.

### Developer Experience

- **Type safety** — Strict mode catches errors at compile time
- **Rich tooling** — ESLint, Prettier, Vitest, tsc
- **Familiar syntax** — Most developers know JavaScript/TypeScript
- **Fast iteration** — Bun runtime provides near-Go startup speeds

### Runtime Choice: Bun

Bun provides:
- Fast startup (comparable to Go)
- Native TypeScript execution (no transpilation needed)
- Built-in test runner, bundler, package manager
- SQLite bindings (better-sqlite3)

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|-----------|
| Slower than Go/Rust | Bun runtime, optimized hot paths |
| Larger binary size | Not a concern for server deployment |
| GC pauses | Minimal impact for our workload |
| Single-threaded JS | Worker threads for embedding generation |

## Consequences

- **Positive:** Faster development, better AI agent code generation, unified language across connectors
- **Negative:** Slightly higher resource usage than Go, dependency on LlamaIndex.TS maturity
- **Neutral:** Requires Bun or Node.js runtime
