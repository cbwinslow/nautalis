import { logMessage, createSpan } from '../telemetry/api.js';
import { SPAN_NAMES } from '../types/telemetry.js';
import { withRetry, CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG, RetryConfig, CircuitBreakerConfig } from '../utils/resilience.js';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
  endpointPath?: string; // default: /api/embeddings
  requestTransform?: (body: any) => any; // customize request body format
  responseTransform?: (data: any) => { embedding: number[] }; // customize response parsing
}

export class EmbeddingService {
  private baseUrl: string;
  private model: string;
  private apiKey?: string;
  private headers: Record<string, string>;
  private endpointPath: string;
  private requestTransform?: (body: any) => any;
  private responseTransform?: (data: any) => { embedding: number[] };
  private circuitBreaker: CircuitBreaker;
  private retryConfig: RetryConfig;

  constructor(options: EmbeddingOptions & { retryConfig?: RetryConfig; circuitBreakerConfig?: CircuitBreakerConfig }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    this.endpointPath = options.endpointPath || '/api/embeddings';
    this.requestTransform = options.requestTransform;
    this.responseTransform = options.responseTransform;
    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER_CONFIG,
      'embedding',
    );
    this.retryConfig = options.retryConfig || {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      backoffFactor: 2,
    };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    return this.circuitBreaker.execute(() =>
      withRetry(() => this.doEmbed(text), this.retryConfig)
    );
  }

  private async doEmbed(text: string): Promise<EmbeddingResult> {
    const span = createSpan(SPAN_NAMES.EMBED_TEXT, {
      'embedding.model': this.model,
      'embedding.text_length': text.length,
    });

    try {
      const embedding = await this.performRequest(text);

      span.end();
      return {
        embedding,
        model: this.model,
        dimensions: embedding.length,
      };
    } catch (error) {
      span.end(error as Error);
      logMessage('error', `Embedding failed: ${error}`);
      throw error;
    }
  }

  private async performRequest(text: string): Promise<number[]> {
    let body: any = { model: this.model, prompt: text };
    if (this.requestTransform) {
      body = this.requestTransform({ model: this.model, prompt: text });
    }

    const response = await fetch(`${this.baseUrl}${this.endpointPath}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Determine if error is retryable
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`Embedding API error (retryable): ${response.status} ${response.statusText}`);
      } else {
        throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    let embedding: number[];

    if (this.responseTransform) {
      const transformed = this.responseTransform(data);
      embedding = transformed.embedding;
    } else {
      // Default: expect { embedding: number[] }
      embedding = data.embedding;
      if (!Array.isArray(embedding)) {
        // Some APIs return { data: [{ embedding: number[] }] }
        if (Array.isArray(data.data) && data.data[0]?.embedding) {
          embedding = data.data[0].embedding;
        } else {
          throw new Error('Unexpected embedding response format');
        }
      }
    }

    return embedding;
  }
  
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    
    return results;
  }
}
