// This is a lightweight Ollama embedding implementation for LlamaIndex.
// It provides getTextEmbedding and getTextEmbeddings methods.
// It does not extend BaseEmbedding to avoid OTel type issues.

export interface OllamaEmbeddingOptions {
  baseUrl?: string;
  model?: string;
}

export class OllamaEmbedding {
  baseUrl: string;
  model: string;
  embeddingDimension = 384; // nomic-embed-text

  constructor(options: OllamaEmbeddingOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'nomic-embed-text';
  }

  async getTextEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  async getTextEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.getTextEmbedding(text));
    }
    return results;
  }
}
