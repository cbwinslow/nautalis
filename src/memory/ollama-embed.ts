import { BaseEmbedding } from 'llamaindex';

export interface OllamaEmbeddingOptions {
  baseUrl?: string;
  model?: string;
}

export class OllamaEmbedding extends BaseEmbedding {
  baseUrl: string;
  model: string;
  
  constructor(options: OllamaEmbeddingOptions = {}) {
    super({
      embeddingDimension: 384, // nomic-embed-text
      maxEmbeddingsPerCall: 1,
    });
    
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
    
    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  }
  
  async getTextEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      embeddings.push(await this.getTextEmbedding(text));
    }
    
    return embeddings;
  }
}
