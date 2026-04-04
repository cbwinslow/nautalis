import {
  VectorStoreIndex,
  Document,
  Settings,
  type LLM as LlamaLLM,
} from 'llamaindex';
import type { NautalisConfig } from '../types/config.js';
import type { MemoryQueryResult } from '../types/memory.js';
import { createSpan, recordMetric, logMessage } from '../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';
import type { Store } from '../store/interface.js';
import { EmbeddingService } from './embed.js';

export class RAGEngine {
  private config: NautalisConfig;
  private store: Store;
  private embeddingService: EmbeddingService;
  private index: VectorStoreIndex | null = null;

  constructor(config: NautalisConfig, store: Store, embeddingService: EmbeddingService) {
    this.config = config;
    this.store = store;
    this.embeddingService = embeddingService;

    // Configure LlamaIndex settings
    const llm = this.configureLLM();
    if (llm) {
      Settings.llm = llm;
    }
  }

  private configureLLM(): LlamaLLM | null {
    const { provider, model } = this.config.llm;
    const Ollama = (require('llamaindex') as any).Ollama;
    const OpenAI = (require('llamaindex') as any).OpenAI;
    const Anthropic = (require('llamaindex') as any).Anthropic;

    try {
      switch (provider) {
        case 'ollama':
          return new Ollama({
            baseUrl: this.config.llm.ollama?.url || 'http://localhost:11434',
            model,
          });

        case 'openai':
          const openaiKey = process.env[this.config.llm.openai?.apiKeyEnv || 'OPENAI_API_KEY'];
          if (!openaiKey) {
            throw new Error(`OpenAI API key not found in env var: ${this.config.llm.openai?.apiKeyEnv || 'OPENAI_API_KEY'}`);
          }
          return new OpenAI({
            apiKey: openaiKey,
            model: this.config.llm.openai?.model || model,
          });

        case 'anthropic':
          const anthropicKey = process.env[this.config.llm.anthropic?.apiKeyEnv || 'ANTHROPIC_API_KEY'];
          if (!anthropicKey) {
            throw new Error(`Anthropic API key not found in env var: ${this.config.llm.anthropic?.apiKeyEnv || 'ANTHROPIC_API_KEY'}`);
          }
          return new Anthropic({
            apiKey: anthropicKey,
            model: this.config.llm.anthropic?.model || model,
          });

        case 'custom':
          if (!this.config.llm.custom?.baseUrl) {
            throw new Error('Custom LLM provider requires baseUrl in config.llm.custom.baseUrl');
          }
          // For custom, we'll use a generic HTTP LLM if available, or fallback to OpenAI-compatible
          // LlamaIndex.TS likely has an OpenACompatible class; we can use OpenAI with custom baseUrl
          const customKey = this.config.llm.custom.apiKeyEnv
            ? process.env[this.config.llm.custom.apiKeyEnv]
            : undefined;
          return new OpenAI({
            baseUrl: this.config.llm.custom.baseUrl,
            apiKey: customKey || 'dummy',
            model: this.config.llm.custom.model || model,
          });

        default:
          const _exhaustive: never = provider;
          logMessage('warn', `Unsupported LLM provider: ${provider}. Synthesis will not work.`);
          return null;
      }
    } catch (error) {
      logMessage('error', `Failed to configure LLM: ${error}`);
      return null;
    }
  }

  async buildIndex(teamId?: string): Promise<VectorStoreIndex> {
    const span = createSpan(SPAN_NAMES.RAG_RETRIEVE + '.build_index');

    try {
      // Ensure we have a teamId
      const targetTeamId = teamId || this.config.general.teamId;
      if (!targetTeamId) {
        throw new Error('teamId is required to build index. Set in config or pass to buildIndex().');
      }

      // Fetch all memories with embeddings from the store
      const memories = await this.store.findSimilarMemories(
        Array(384).fill(0), // dummy vector to get all
        targetTeamId,
        10000, // high limit
        0, // minScore 0 to get all
        { userId: this.config.general.userId }
      );

      // Convert memories to LlamaIndex Documents
      const documents: Document[] = memories.map((result) => {
        const memory = result.memory;
        const text = memory.content.summary + (memory.content.detail ? '\n' + memory.content.detail : '');
        
        return new Document({
          text,
          metadata: {
            memory_id: memory.id,
            team_id: memory.context.teamId,
            project_id: memory.context.projectId,
            agent_name: memory.agentIdentity.agentName || memory.agentIdentity.toolName,
            agent_type: memory.agentIdentity.toolName, // using toolName as agent_type
            memory_type: memory.classification.memoryType,
            topics: memory.classification.topics,
            importance: memory.classification.importance,
            sensitivity: memory.classification.sensitivity,
            created_at: memory.createdAt.toISOString(),
            embedding: memory.embedding,
          },
        });
      });

      logMessage('info', `Building RAG index with ${documents.length} memories for team ${targetTeamId}`);

      // Create index from documents
      this.index = await VectorStoreIndex.fromDocuments(documents);

      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_STORED, documents.length, { action: 'index_built' });
      return this.index;
    } catch (error) {
      span.end(error as Error);
      logMessage('error', `Failed to build index: ${error}`);
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
    options?: { teamId?: string; projectId?: string; limit?: number; userId?: string },
  ): Promise<MemoryQueryResult[]> {
    const span = createSpan(SPAN_NAMES.RAG_RETRIEVE, {
      'query.text': queryText,
      'query.project': options?.projectId || 'all',
    });

    try {
      // Generate embedding for the query text
      const embeddingResult = await this.embeddingService.embed(queryText);
      const embedding = embeddingResult.embedding;

      // Use teamId from config or options
      const teamId = options?.teamId || this.config.general.teamId;
      if (!teamId) {
        throw new Error('teamId is required for query. Set in config or pass to query().');
      }

      // Use userId from options or config
      const userId = options?.userId || this.config.general.userId;
      if (!userId) {
        throw new Error('userId is required for query. Set userId in config or pass as option.');
      }

      // Perform vector similarity search via store
      // Note: store.findSimilarMemories returns MemoryQueryResult[] directly
      const results = await this.store.findSimilarMemories(embedding, teamId, options?.limit || 10, undefined, { userId });

      // Filter by projectId if provided
      if (options?.projectId) {
        return results.filter((r: MemoryQueryResult) => r.memory.context.projectId === options.projectId);
      }

      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_QUERIED, results.length, { query_type: 'rag' });

       return results;
     } catch (error) {
       span.end(error as Error);
       throw error;
     }
   }

  async synthesize(query: string, context: string[]): Promise<string> {
    const span = createSpan(SPAN_NAMES.RAG_SYNTHESIZE);

    try {
      // Use LLM to synthesize answer from context
      const llm = (Settings as any).llm;
      if (!llm) {
        throw new Error(
          'LLM not configured. Set config.llm.provider to ollama, openai, or anthropic.',
        );
      }

      // Format context with numbering
      const contextStr = context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');

      const prompt = `You are a helpful assistant with access to a knowledge base of past AI agent activities. Answer the question based ONLY on the provided context. If the context doesn't contain the answer, say "I don't know based on the available memories."

Context:
${contextStr}

Question: ${query}

Answer:`;

      const response = await llm.complete(prompt);
      const answer =
        typeof response === 'string'
          ? response
          : (response as any)?.text || JSON.stringify(response);

      span.end();
      return answer.trim();
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
}
