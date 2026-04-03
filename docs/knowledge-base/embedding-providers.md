# Embedding Providers

Nautalis supports multiple embedding providers for generating vector representations of memories.

## Overview

| Provider | Cost | Setup | Quality | Best For |
|----------|------|-------|---------|----------|
| **Ollama** | Free | Local install | Good | Personal, offline-first |
| **OpenAI** | Paid ($0.02/1M tokens) | API key | Excellent | Production, team |
| **Cohere** | Paid (free tier available) | API key | Excellent | Enterprise |
| **Custom** | Varies | Implementation | Varies | Specialized needs |

## Ollama (Default)

Fully local, zero-cost embedding generation.

**Configuration:**
```toml
[embeddings]
provider = "ollama"
model = "nomic-embed-text"
baseUrl = "http://localhost:11434"
dimensions = 768
```

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull embedding model
ollama pull nomic-embed-text

# Start Ollama server
ollama serve
```

**Recommended Models:**

| Model | Dimensions | Speed | Quality | Size |
|-------|-----------|-------|---------|------|
| `nomic-embed-text` | 768 | Fast | Good | 274 MB |
| `mxbai-embed-large` | 1024 | Medium | Very Good | 670 MB |
| `all-minilm` | 384 | Very Fast | Decent | 23 MB |
| `snowflake-arctic-embed` | 1024 | Medium | Very Good | 460 MB |

**Usage:**
```typescript
import { OllamaEmbedding } from 'llamaindex';

const embedModel = new OllamaEmbedding({
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434',
});

const embedding = await embedModel.getTextEmbedding('memory content here');
// Returns: number[] (768 dimensions)
```

**Performance:**
- Single embedding: ~50-200ms (depends on hardware)
- Batch (32): ~1-3s
- No network latency (local)

## OpenAI API

Cloud-based embeddings with state-of-the-art quality.

**Configuration:**
```toml
[embeddings]
provider = "openai"
model = "text-embedding-3-small"
apiKey = "${OPENAI_API_KEY}"
dimensions = 1536
```

**Available Models:**

| Model | Dimensions | Cost (per 1M tokens) | Quality |
|-------|-----------|---------------------|---------|
| `text-embedding-3-small` | 1536 | $0.02 | Excellent |
| `text-embedding-3-large` | 3072 | $0.13 | State-of-the-art |
| `text-embedding-ada-002` | 1536 | $0.10 | Good (legacy) |

**Usage:**
```typescript
import { OpenAIEmbedding } from 'llamaindex';

const embedModel = new OpenAIEmbedding({
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
  dimensions: 1536,
});

const embedding = await embedModel.getTextEmbedding('memory content here');
```

**Performance:**
- Single embedding: ~100-500ms (network dependent)
- Batch (32): ~2-5s
- Requires internet connection

**Rate Limits:**
- text-embedding-3-small: 3,000 RPM / 2,000,000 TPM
- text-embedding-3-large: 1,000 RPM / 1,000,000 TPM

## Cohere API

Enterprise-grade embeddings with strong multilingual support.

**Configuration:**
```toml
[embeddings]
provider = "cohere"
model = "embed-english-v3.0"
apiKey = "${COHERE_API_KEY}"
dimensions = 1024
```

**Available Models:**

| Model | Dimensions | Languages | Cost |
|-------|-----------|-----------|------|
| `embed-english-v3.0` | 1024 | English | Free tier / paid |
| `embed-multilingual-v3.0` | 1024 | 100+ languages | Free tier / paid |
| `embed-english-light-v3.0` | 384 | English | Free tier / paid |

**Usage:**
```typescript
import { CohereEmbedding } from 'llamaindex';

const embedModel = new CohereEmbedding({
  model: 'embed-english-v3.0',
  apiKey: process.env.COHERE_API_KEY,
});

const embedding = await embedModel.getTextEmbedding('memory content here');
```

**Performance:**
- Single embedding: ~100-300ms
- Batch (96): ~1-2s (Cohere supports large batches)

## Custom Embedding Providers

Implement your own embedding provider by extending the base interface:

```typescript
export interface EmbeddingProvider {
  name: string;
  dimensions: number;

  initialize(config: EmbeddingConfig): Promise<void>;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}
```

**Example: Custom HuggingFace provider:**

```typescript
export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'huggingface';
  readonly dimensions = 768;

  async initialize(config: EmbeddingConfig): Promise<void> {
    // Set up HuggingFace Inference API
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api-inference.huggingface.co/models/...', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });
    return response.json();
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.generateEmbedding(t)));
  }

  async healthCheck(): Promise<boolean> {
    // Check API connectivity
    return true;
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }
}
```

## Configuration Priority

Embedding provider is resolved in this order:

1. CLI flag: `--embeddings <provider>`
2. Environment: `NAUTALIS_EMBEDDINGS_PROVIDER`
3. Config file: `embeddings.provider`
4. Default: `ollama`

## Switching Providers

When switching embedding providers, existing embeddings remain valid but new memories will use the new model. For consistent search results:

```bash
# Regenerate all embeddings with new provider
nautalis memory regenerate-embeddings --provider openai
```

**Note:** Embeddings from different models are NOT compatible. After switching providers, you must regenerate all existing embeddings for accurate similarity search.

## Performance Tuning

### Batch Size

```toml
[embeddings]
batchSize = 32  # Default, adjust based on provider
```

| Provider | Recommended Batch Size |
|----------|----------------------|
| Ollama | 16-64 |
| OpenAI | 100-200 |
| Cohere | 96 |

### Caching

Embeddings are cached in the database to avoid regeneration. Cache key is the content hash.

### Fallback

Configure a fallback provider for resilience:

```toml
[embeddings]
provider = "openai"
fallbackProvider = "ollama"
```

If the primary provider is unavailable, Nautalis falls back to the secondary provider.
