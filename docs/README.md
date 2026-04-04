# Nautalis Documentation

Universal AI Agent Memory & Orchestration Platform

## Getting Started

- [Quick Start Guide](guides/getting-started.md)
- [Installation](guides/installation.md)
- [Configuration Reference](knowledge-base/configuration.md)

## Knowledge Base

- [Overview](knowledge-base/overview.md) — What is Nautalis?
- [Architecture](knowledge-base/architecture.md) — System design and components
- [Connectors](knowledge-base/connectors.md) — How agent integrations work
- [Memory Schema](knowledge-base/memory-schema.md) — Rich metadata model
- [Embedding Providers](knowledge-base/embedding-providers.md) — Ollama, OpenAI, Cohere
- [Storage Backends](knowledge-base/storage-backends.md) — SQLite, PostgreSQL, Supabase
- [CLI Reference](knowledge-base/cli-reference.md) — All commands
- [API Reference](knowledge-base/api-reference.md) — REST API endpoints
- [MCP Server](knowledge-base/mcp-server.md) — Model Context Protocol
- [Team Setup](knowledge-base/team-setup.md) — Multi-user deployment
- [Troubleshooting](knowledge-base/troubleshooting.md) — Common issues

## Guides

- [Getting Started](guides/getting-started.md)
- [Claude Code Integration](guides/connectors/claude-code.md)
- [Kilo Code Integration](guides/connectors/kilo-code.md)
- [Adding New Connectors](guides/connectors/adding-connectors.md)
- [Memory Management](guides/memory-management.md)
- [Context Injection](guides/context-injection.md)
- [Team Deployment](guides/team-deployment.md)
- [Enterprise Setup](guides/enterprise-setup.md)

## Architecture Decisions

- [001 — TypeScript over Go](decisions/001-typescript-over-go.md)
- [002 — LlamaIndex.TS for RAG](decisions/002-llamaindex-for-rag.md)
- [003 — OpenTelemetry for Observability](decisions/003-opentelemetry-observability.md)
- [004 — SQLite as Default Storage](decisions/004-sqlite-default-storage.md)
- [005 — Ollama for Local Embeddings](decisions/005-ollama-local-embeddings.md)

## Project Analysis

- [Comprehensive Review & Strategic Analysis (2026-04-03)](decisions/COMPREHENSIVE_REVIEW_2026-04-03.md) — Detailed evaluation of architecture, implementation gaps, tech stack, and 90-day action plan

## Project Tracking

- [Implementation Status](../IMPLEMENTATION_STATUS.md) — Feature completeness and implementation gaps

## API Specifications

- [OpenAPI Specification](api/openapi.yaml)
- [MCP Server Specification](api/mcp-spec.json)
