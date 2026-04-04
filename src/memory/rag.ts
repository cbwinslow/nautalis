import {
  VectorStoreIndex,
  SimpleDirectoryReader,
  storageContextFromDefaults,
  Settings,
  Document,
} from 'llamaindex';
import type { NautalisConfig } from '../types/config.js';
import type { MemoryQueryResult } from '../types/memory.js';
import { createSpan, recordMetric, logMessage } from '../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';
import { OllamaEmbedding } from './ollama-embed.js';

export class RAGEngine {
  private config: NautalisConfig;
  private index: VectorStoreIndex | null = null;

  constructor(config: NautalisConfig) {
    this.config = config;

    // Configure LlamaIndex settings
    Settings.embedModel = new OllamaEmbedding({
      baseUrl: config.embeddings.ollama?.url || 'http://localhost:11434',
      model: config.embeddings.model,
    }) as any; // cast to any to bypass BaseEmbedding compatibility issues

    // Configure LLM for synthesis
    if (config.llm.provider === 'ollama') {
      Settings.llm = new (require('llamaindex').Ollama)({
        baseUrl: config.llm.ollama?.url || 'http://localhost:11434',
        model: config.llm.model,
      });
    }
  }

  async buildIndex(): Promise<VectorStoreIndex> {
    const span = createSpan(SPAN_NAMES.RAG_RETRIEVE + '.build_index');

    try {
      // TODO: Build index from stored memories
      // For now, create empty index
      this.index = await VectorStoreIndex.fromDocuments([]);

      span.end();
      logMessage('info', 'RAG index built successfully');
      return this.index;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

  async addDocument(text: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.index) {
      this.index = await this.buildIndex();
    }

    const doc = new Document({ text, metadata });
    await this.index.insert(doc);
  }

  async query(
    queryText: string,
    options?: { projectId?: string; limit?: number },
  ): Promise<MemoryQueryResult[]> {
    const span = createSpan(SPAN_NAMES.RAG_RETRIEVE, {
      'query.text': queryText,
      'query.project': options?.projectId || 'all',
    });

    try {
      if (!this.index) {
        this.index = await this.buildIndex();
      }

      const queryEngine = this.index.asQueryEngine({
        similarityTopK: options?.limit || 10,
      });

      const response = await queryEngine.query({ query: queryText });

      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_QUERIED, 1, { query_type: 'rag' });

      // Convert response to MemoryQueryResult
      // TODO: Parse response into structured memory results
      return [];
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }

  async synthesize(query: string, context: string[]): Promise<string> {
    const span = createSpan(SPAN_NAMES.RAG_SYNTHESIZE);

    try {
      if (!this.index) {
        this.index = await this.buildIndex();
      }

      // TODO: Use LlamaIndex synthesizer for cross-source synthesis
      logMessage('info', `Synthesizing response for query: ${query}`);

      span.end();
      return `Based on the context provided, here's what I found about "${query}":\n\n${context.join('\n\n')}`;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
}
