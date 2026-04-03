import { logMessage, createSpan } from '../telemetry/api.js';
import { SPAN_NAMES } from '../types/telemetry.js';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export class EmbeddingService {
  private baseUrl: string;
  private model: string;
  
  constructor(options: { baseUrl: string; model: string }) {
    this.baseUrl = options.baseUrl;
    this.model = options.model;
  }
  
  async embed(text: string): Promise<EmbeddingResult> {
    const span = createSpan(SPAN_NAMES.EMBED_TEXT, {
      'embedding.model': this.model,
      'embedding.text_length': text.length,
    });
    
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      
      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as { embedding: number[] };
      
      span.end();
      
      return {
        embedding: data.embedding,
        model: this.model,
        dimensions: data.embedding.length,
      };
    } catch (error) {
      span.end(error as Error);
      logMessage('error', `Embedding failed: ${error}`);
      throw error;
    }
  }
  
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    
    return results;
  }
}
