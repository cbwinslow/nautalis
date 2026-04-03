# ADR 005: Ollama for Local Embeddings

**Status:** Accepted  
**Date:** 2026-01-15  
**Context:** Default embedding provider selection

## Decision

We chose **Ollama** as the default embedding provider for Nautalis.

## Alternatives Considered

1. **OpenAI API** — Highest quality, but requires API key and costs money
2. **Cohere API** — Good quality, free tier, but still cloud-dependent
3. **HuggingFace Inference** — Free tier, but rate-limited and slower
4. **Ollama** — Fully local, free, good quality, offline-first

## Rationale

### Zero Cost

Ollama runs locally with no API costs. This aligns with our zero-cost principle — Nautalis works entirely free with SQLite + Ollama.

### Offline-First

Ollama runs on the local machine. No internet connection required for embedding generation. This is critical for:
- Privacy-sensitive environments
- Air-gapped systems
- Reliable operation regardless of network status

### Good Quality

The `nomic-embed-text` model provides good embedding quality for code and technical content:

| Model | Dimensions | MTEB Score | Size |
|-------|-----------|------------|------|
| nomic-embed-text | 768 | 64.2 | 274 MB |
| mxbai-embed-large | 1024 | 66.8 | 670 MB |
| all-minilm | 384 | 57.1 | 23 MB |

### Easy Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull nomic-embed-text

# That's it — ready to generate embeddings
```

### GPU Acceleration

Ollama automatically uses GPU acceleration when available, making embedding generation fast:
- CPU: ~200ms per embedding
- GPU: ~50ms per embedding

### Pluggable

Ollama is the default, but users can easily switch to cloud providers:

```toml
[embeddings]
provider = "openai"  # or "cohere"
model = "text-embedding-3-small"
apiKey = "${OPENAI_API_KEY}"
```

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|-----------|
| Lower quality than OpenAI | Sufficient for code/technical content |
| Requires local resources (RAM/GPU) | Models are small (274MB for nomic) |
| Slower than cloud APIs | GPU acceleration, batch processing |
| Model selection limited | Multiple good options available |

## Consequences

- **Positive:** Fully free, offline, private, easy setup
- **Negative:** Slightly lower quality than top cloud models
- **Neutral:** Uses local compute resources (minimal for embedding models)
