# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2026-04-05)

- **Integration Test Reliability** — Fixed test fixtures with proper team/user creation and owner role; all integration tests now deterministic.
- **Store-Integration Test Suite** — New `test/integration/store-integration.test.ts` covering insertEvent, listMemories, and knowledge base operations using MemoryEngine for realistic ingestion.
- **EmbeddingService Comprehensive Tests** — Rewrote and expanded unit test coverage for EmbeddingService with mocks; tests for request/response transforms, error handling, batch embedding, endpoint configuration (16 tests).
- **MemoryEngine Unit Tests** — Added 7 tests covering processEvent, ingestEvents, ask, query, PII redaction, and teamId enforcement.
- **DecisionExtractor Tests** — 5 tests covering regex fallback, LLM extraction path, and topic inference; 100% coverage of extract.ts.
- **RAGEngine Unit Tests** — 3 tests for invalidateIndex, buildIndex integration, and constructor.
- **RAGEngine Hybrid Search Tests** — Added 4 unit tests covering hybrid search edge cases: empty result sets, score normalization, overlapping vs non-overlapping results, and limit application.
- **KnowledgeBaseEngine Tests** — 4 tests for create (with/without embedding), get, and schema validation; increased coverage to 55% functions.
- **PermissionManager Tests** — 4 tests for check, caching, grant with audit, and cache clearing; 100% coverage.
- **Provider Implementation Tests** — Unit tests for OllamaProvider, OpenAIProvider, AnthropicProvider, CohereProvider verifying embedding/LLM creation and capability enforcement (8 tests).
- **OllamaLLM Tests** — Unit tests for OllamaLLM decision extraction client (9 tests); covers prompt construction, response parsing (including code blocks), error handling for non-retryable and retryable failures; 100% coverage of ollama-llm.ts.
- **CompositeProvider Tests** — Unit tests for CompositeProvider covering delegation, provider selection, and error handling (8 tests); increased provider coverage.
- **Provider Implementations** — `AnthropicProvider` (LLM only) and `CohereProvider` (embeddings only), completing core multi-provider abstractions for LLM and embedding services.
- **CompositeProvider** — Added fallback provider that delegates to multiple inner providers with cascading retry logic for resilience.
- **ProviderRegistry Update** — Registry now instantiates Anthropic, Cohere, and Composite providers based on `providers` config.
- **Providers CLI Command** — Added `nautalis providers list` to display configured providers and their availability status.
- **RAG Index Invalidation** — Added `invalidateIndex()` method to `RAGEngine` to force index rebuild on next query, ensuring fresh retrieval after data changes.
- **Semantic Injection in Daemon** — Upgraded `/api/context/inject` endpoint to use semantic search via `RAGEngine.query()` when `rag.useSemanticInject` is enabled; retains recency fallback.
- **Configuration Option** — Added `rag.useSemanticInject` boolean to enable semantic injection in daemon context builder.
- **Documentation Updates** — FEATURES.md and IMPLEMENTATION_STATUS.md refreshed with current completeness: Overall ~90%, Storage 90%, RAG 88%, Team 90%, CLI 95%, Security 75%, Memory Enrichment 70%, Context Injection 60%, Observability 45%, Test Infrastructure 70%, Connector System 40%.
- **Letta Memory Sync** — Stored 24 archival memories and 3 core memory blocks in Letta using `letta_memory` skill for cross-agent context continuity.

### Fixed (2026-04-05)

- **Test Infrastructure** — All 173 tests passing (unit + integration). Added comprehensive unit tests for MemoryEngine, DecisionExtractor, RAGEngine (including hybrid search), KnowledgeBaseEngine, PermissionManager, Provider Implementations (Ollama, OpenAI, Anthropic, Cohere), CompositeProvider, OllamaLLM client, merge utility, telemetry provider, embed-factory, and resilience; expanded integration tests with memory CRUD. Coverage: ~73% functions, ~84% lines (local unit run).
- **Integration Tests** — No longer skipped when DATABASE_URL is set; create real team/user data and clean up via store operations.
- **Database Indexes** — Previously disabled indexes are now fully operational via migrations 010 (FTS) and 011 (HNSW vectors).
- **Daemon Event Conversion** — Improved mapping of Claude Code hook payloads to NautalisEvent with better error logging and pre-validation.
- **PII Redaction** — Preserved Date instances during redaction to avoid timestamp corruption.
- **Vector Dimension** — Updated embedding tables to `vector(768)` to match nomic-embed-text output; migration 012 included.

### Changed (2026-04-05)

- **Integration Tests** — Now require DATABASE_URL and will create real team/user data; no longer skipped when DB available.
- **Test Infrastructure** — Consolidated common setup patterns; added debug helpers for troubleshooting.
- **Multi-Provider Config** — Types integrated into `types/config.ts`; legacy direct config still supported.

(Previous entries follow)
