# ADR 002: LlamaIndex.TS for RAG

**Status:** Accepted  
**Date:** 2026-01-15  
**Context:** RAG framework selection

## Decision

We chose **LlamaIndex.TS** as the RAG (Retrieval-Augmented Generation) framework for Nautalis.

## Alternatives Considered

1. **LlamaIndex (Python)** — More mature, more features
2. **LangChain (TS)** — Popular, but heavier abstraction
3. **Custom RAG** — Full control, more maintenance
4. **LlamaIndex.TS** — Official TS port, good balance

## Rationale

### TypeScript Native

LlamaIndex.TS is the official TypeScript port of LlamaIndex, maintained by the same organization. It provides:

- `VectorStoreIndex` for vector-based retrieval
- `SimpleNodeParser` for document chunking
- `serviceContextFromDefaults` for embedding configuration
- Multiple retriever strategies (top-k, similarity, hybrid)

### Feature Set

LlamaIndex.TS provides everything we need:

| Feature | Support |
|---------|---------|
| Vector store index | Yes |
| Embedding models | Multiple providers |
| Document parsing | Yes |
| Query engines | Yes |
| Chat engines | Yes |
| Custom retrievers | Yes |

### Integration with Our Stack

```typescript
import { VectorStoreIndex, serviceContextFromDefaults, OllamaEmbedding } from 'llamaindex';

const embedModel = new OllamaEmbedding({
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434',
});

const serviceContext = serviceContextFromDefaults({ embedModel });
const index = await VectorStoreIndex.fromDocuments(documents, { serviceContext });
```

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|-----------|
| Less mature than Python version | Core features we need are stable |
| Fewer advanced features | Implement custom retrievers when needed |
| Smaller community | Python docs are largely applicable |

## Consequences

- **Positive:** Unified TypeScript stack, good RAG features, active development
- **Negative:** Some advanced features require custom implementation
- **Neutral:** Tied to LlamaIndex.TS release cycle
