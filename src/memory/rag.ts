import {
  VectorStoreIndex,
  Document,
  Settings,
  type LLM as LlamaLLM,
} from 'llamaindex';
import type { NautalisConfig } from '../types/config.js';
import type { Memory, MemoryQueryResult } from '../types/memory.js';
import { createSpan, recordMetric, logMessage } from '../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';
import type { Store } from '../store/interface.js';
import { EmbeddingService } from './embed.js';
import type { ProviderRegistry } from '../providers/registry.js';

export class RAGEngine {
  private config: NautalisConfig;
  private store: Store;
  private embeddingService: EmbeddingService;
  private index: VectorStoreIndex | null = null;
  private providerRegistry?: ProviderRegistry;

  constructor(config: NautalisConfig, store: Store, embeddingService: EmbeddingService, providerRegistry?: ProviderRegistry) {
    this.config = config;
    this.store = store;
    this.embeddingService = embeddingService;
    this.providerRegistry = providerRegistry;

    // Configure LlamaIndex settings
    const llm = this.configureLLM();
    if (llm) {
      Settings.llm = llm;
    }
    const embedModel = this.configureEmbeddingModel();
    if (embedModel) {
      Settings.embedModel = embedModel;
    }
  }

   private configureLLM(): LlamaLLM | null {
     const { provider, model } = this.config.llm;

     // Try provider registry first if available
     if (this.providerRegistry && this.providerRegistry.hasProvider(provider)) {
       try {
         const p = this.providerRegistry.getProvider(provider);
         if (p.supports('llm')) {
           return p.createLLM();
         } else {
           logMessage('warn', `Provider "${provider}" does not support LLM`);
         }
       } catch (err) {
         logMessage('warn', `Provider "${provider}" failed: ${err}. Falling back to direct config.`);
       }
     }

     // Fallback to direct configuration (legacy)
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

   private configureEmbeddingModel(): any {
     const { provider, model, ollama, openai, cohere, custom } = this.config.embeddings;
     const LlamaIndex = require('llamaindex');
     try {
       switch (provider) {
         case 'ollama':
           return new LlamaIndex.OllamaEmbedding({
             baseUrl: ollama?.url || 'http://localhost:11434',
             model,
           });
         case 'openai':
           const openaiKey = process.env[openai?.apiKeyEnv || 'OPENAI_API_KEY'];
           if (!openaiKey) {
             throw new Error(`OpenAI API key not found for embedding provider (env: ${openai?.apiKeyEnv || 'OPENAI_API_KEY'})`);
           }
           return new LlamaIndex.OpenAIEmbedding({
             apiKey: openaiKey,
             model: openai?.model || model,
           });
         case 'cohere':
           const cohereKey = process.env[cohere?.apiKeyEnv || 'COHERE_API_KEY'];
           if (!cohereKey) {
             throw new Error(`Cohere API key not found for embedding provider (env: ${cohere?.apiKeyEnv || 'COHERE_API_KEY'})`);
           }
           return new LlamaIndex.CohereEmbedding({
             apiKey: cohereKey,
             model: cohere?.model || model,
           });
         case 'custom':
           const customKey = custom?.apiKeyEnv ? process.env[custom.apiKeyEnv] : undefined;
           return new LlamaIndex.OpenAIEmbedding({
             baseURL: custom?.baseUrl,
             apiKey: customKey || 'dummy',
             model: custom?.model || model,
           });
         default:
           logMessage('warn', `Unsupported embedding provider: ${provider}.`);
           return null;
       }
     } catch (error) {
       logMessage('error', `Failed to configure embedding model: ${error}`);
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

      // Determine correct embedding dimension by requesting a sample embedding
      const sampleEmbedding = await this.embeddingService.embed('dimension test');
      const embeddingDim = sampleEmbedding.embedding.length;
      const dummyVector = Array(embeddingDim).fill(0);

      // Fetch all memories with embeddings from the store using dummy vector of correct dimension
      const memories = await this.store.findSimilarMemories(
        dummyVector,
        targetTeamId,
        10000, // high limit
        0, // minScore 0 to get all
        { userId: this.config.general.userId }
      );

      // Convert memories to LlamaIndex Documents, filtering out those without embeddings
      const documents: Document[] = memories
        .filter((result) => result.memory.embedding && result.memory.embedding.length > 0)
        .map((result) => {
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
      options?: { teamId?: string; projectId?: string; limit?: number; userId?: string; useHybrid?: boolean },
    ): Promise<MemoryQueryResult[]> {
      const span = createSpan(SPAN_NAMES.RAG_RETRIEVE, {
        'query.text': queryText,
        'query.project': options?.projectId || 'all',
      });

      try {
       const teamId = options?.teamId || this.config.general.teamId;
       if (!teamId) {
         throw new Error('teamId is required for query. Set in config or pass to query().');
       }

       const userId = options?.userId || this.config.general.userId;
       if (!userId) {
         throw new Error('userId is required for query. Set userId in config or pass as option.');
       }

       const limit = options?.limit || 10;

       // If index is not built, build it now
       if (!this.index) {
         logMessage('info', 'RAG index not built, building now...');
         await this.buildIndex(teamId);
       }

       // Get vector search results
       let vectorResults: MemoryQueryResult[];
       if (this.index) {
         const retriever = this.index.asRetriever({
           similarityTopK: limit,
         });
         const nodes = await retriever.retrieve(queryText);

         const memoryIds = nodes
           .map((node: any) => node.node?.metadata?.memory_id)
           .filter((id: string | undefined) => id) as string[];

         if (memoryIds.length === 0) {
           vectorResults = [];
         } else {
           const memories = await this.store.getMemoriesByIds(memoryIds, { teamId, userId });
           const memoryMap = new Map(memories.map(m => [m.id, m]));
           const orderedMemories = memoryIds
             .map(id => memoryMap.get(id))
             .filter((m): m is Memory => !!m);

           vectorResults = orderedMemories.map((memory, idx) => {
             const node = nodes[idx];
             const score = node?.score ?? 0;
             return { memory, score, matchedTopics: [], matchedFiles: [] };
           });
         }
       } else {
         // Fallback to raw vector search
         const embeddingResult = await this.embeddingService.embed(queryText);
         const embedding = embeddingResult.embedding;
         vectorResults = await this.store.findSimilarMemories(embedding, teamId, limit, undefined, { userId });
       }

       // If hybrid search requested, also perform full-text search and combine
       if (options?.useHybrid) {
         const ftResults = await this.store.fullTextSearchMemories(teamId, queryText, limit * 2, { userId });

         // Normalize scores from both sets to 0-1 range based on max in each set
         const maxVecScore = vectorResults.length > 0 ? Math.max(...vectorResults.map(r => r.score)) : 0;
         const maxFtScore = ftResults.length > 0 ? Math.max(...ftResults.map(r => r.score)) : 0;

         const combinedMap = new Map<string, { memory: Memory; vecNorm: number; ftNorm: number }>();

         for (const r of vectorResults) {
           const vecNorm = maxVecScore > 0 ? r.score / maxVecScore : 0;
           combinedMap.set(r.memory.id, { memory: r.memory, vecNorm, ftNorm: 0 });
         }
         for (const r of ftResults) {
           const ftNorm = maxFtScore > 0 ? r.score / maxFtScore : 0;
           const existing = combinedMap.get(r.memory.id);
           if (existing) {
             existing.ftNorm = ftNorm;
           } else {
             combinedMap.set(r.memory.id, { memory: r.memory, vecNorm: 0, ftNorm });
           }
         }

         // Compute weighted hybrid score (equal weight)
         const alpha = 0.5;
         const combined: MemoryQueryResult[] = Array.from(combinedMap.values()).map(entry => ({
           memory: entry.memory,
           score: alpha * entry.vecNorm + alpha * entry.ftNorm,
           matchedTopics: [],
           matchedFiles: [],
         }));

         // Sort by hybrid score descending
         combined.sort((a, b) => b.score - a.score);

         // Apply limit
         const limited = combined.slice(0, limit);

         // Filter by projectId if provided
         const finalResults = options?.projectId
           ? limited.filter(r => r.memory.context.projectId === options.projectId)
           : limited;

         span.end();
         recordMetric(METRIC_NAMES.MEMORIES_QUERIED, finalResults.length, { query_type: 'hybrid' });
         return finalResults;
       }

       // Otherwise, return pure vector results
       if (options?.projectId) {
         vectorResults = vectorResults.filter(r => r.memory.context.projectId === options.projectId);
       }

       span.end();
       recordMetric(METRIC_NAMES.MEMORIES_QUERIED, vectorResults.length, { query_type: options?.useHybrid ? 'hybrid' : 'vector_only' });
       return vectorResults;
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

   /**
    * Invalidate the index, forcing a rebuild on next query.
    * Call this after ingestion to ensure fresh data.
    */
   public invalidateIndex(): void {
     this.index = null;
   }
}
