import type { NautalisEvent } from '../types/event.js';
import type { Memory } from '../types/memory.js';
import type { Store } from '../store/interface.js';
import type { NautalisConfig } from '../types/config.js';
import { MemoryClassifier } from './classify.js';
import { DecisionExtractor } from './extract.js';
import { OllamaLLM } from './ollama-llm.js';
import { EmbeddingService } from './embed.js';
import { createEmbeddingService } from './embed-factory.js';
 import { RAGEngine } from './rag.js';
 import { v4 as uuidv4 } from 'uuid';
 import { createSpan, recordMetric, logMessage, benchmarkOperation } from '../telemetry/api.js';
 import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';
 import { NautalisEventSchema } from '../validation/schemas.js';
 import { redactSensitiveData } from '../utils/pii-detector.js';
 import { ProviderRegistry } from '../providers/registry.js';

export class MemoryEngine {
  private classifier: MemoryClassifier;
  private decisionExtractor: DecisionExtractor;
  private embeddingService: EmbeddingService;
  private ragEngine: RAGEngine;
  private store: Store;
  private config: NautalisConfig;

  constructor(store: Store, config: NautalisConfig) {
    this.store = store;
    this.config = config;
    this.classifier = new MemoryClassifier();

    // Initialize LLM for decision extraction if configured (legacy Ollama only for now)
    const llm =
      config.llm.provider === 'ollama'
        ? new OllamaLLM({
            baseUrl: config.llm.ollama?.url || 'http://localhost:11434',
            model: config.llm.model,
          })
        : undefined;

    this.decisionExtractor = new DecisionExtractor(llm);

    // Use provider registry for embedding service if available, else fallback to factory
    let registry: ProviderRegistry | undefined;
    try {
      registry = new ProviderRegistry(config.providers);
      const embeddingProviderName = config.embeddings.provider;
      if (registry.hasProvider(embeddingProviderName)) {
        this.embeddingService = registry.getProvider(embeddingProviderName).createEmbeddingService();
        logMessage('info', `Using provider "${embeddingProviderName}" for embeddings`);
      } else {
        // Fallback to legacy factory (handles direct provider types)
        this.embeddingService = createEmbeddingService(config);
      }
    } catch (error) {
      logMessage('warn', `Provider registry failed: ${error}. Falling back to legacy embedding service.`);
      this.embeddingService = createEmbeddingService(config);
    }

    this.ragEngine = new RAGEngine(config, store, this.embeddingService, registry);
  }

  async processEvent(event: NautalisEvent): Promise<Memory[]> {
    const span = createSpan(SPAN_NAMES.ENRICH_MEMORY, {
      'event.type': event.type,
      'event.tool': event.toolName || 'unknown',
    });

    try {
      // Validate incoming event
      const validatedEvent = NautalisEventSchema.parse(event);

      const memories: Memory[] = [];

      // Classify the event
      const classification = this.classifier.classify(validatedEvent);

      // Generate embedding for the event summary
      const summary = this.generateSummary(validatedEvent);
      const embeddingResult = await this.embeddingService.embed(summary);

      // Ensure teamId is set: use event context or fall back to config
      const teamId = validatedEvent.context.teamId || this.config.general.teamId;
      if (!teamId) {
        throw new Error(
          'teamId is required for memory processing. Set in config or event context.',
        );
      }

      // Build context with teamId
      const memoryContext = {
        ...validatedEvent.context,
        teamId,
      };

      // Create memory
      const memory: Memory = {
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        agentIdentity: validatedEvent.source,
        context: memoryContext,
        classification,
        content: {
          summary,
          detail: this.generateDetail(validatedEvent),
          filesInvolved: validatedEvent.filesInvolved,
          commandsExec: validatedEvent.toolInput?.command ? [validatedEvent.toolInput.command] : [],
          errorsSeen: validatedEvent.extracted.errors,
          codeSnippets: [],
        },
        relationships: {
          parentMemoryId: undefined,
          supersedes: [],
          contradicts: [],
          supports: [],
          tags: classification.topics,
        },
        lifecycle: {
          ttl: undefined,
          decayRate: 0.01,
          lastAccess: new Date(),
          accessCount: 0,
          isStale: false,
        },
        embedding: embeddingResult.embedding,
      };

      // Extract decisions
      const decisions = await this.decisionExtractor.extract(validatedEvent);
      for (const decision of decisions) {
        const decisionMemory: Memory = {
          ...memory,
          id: uuidv4(),
          classification: {
            ...classification,
            memoryType: 'decision',
            blockLabel: decision.topic,
          },
          content: {
            ...memory.content,
            summary: decision.decision,
            detail: decision.reasoning,
          },
        };
        memories.push(decisionMemory);
      }

      // Always add the main memory
      memories.push(memory);

      // Store all memories
      for (const mem of memories) {
        await this.store.insertMemory(mem, {
          userId: mem.agentIdentity.userId,
          teamId: mem.context.teamId,
        });
      }

      span.end();
      recordMetric(METRIC_NAMES.MEMORIES_STORED, memories.length);

      return memories;
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }



  async ingestEvents(events: NautalisEvent[]): Promise<number> {
    const allMemories: Memory[] = [];

    for (let event of events) {
      // Validate incoming event
      let validatedEvent = NautalisEventSchema.parse(event);

      // Apply PII redaction if enabled
      if (this.config.guardrails.piiDetection) {
        validatedEvent = redactSensitiveData(validatedEvent) as any;
      }

      // Ensure teamId is set: use event context or fall back to config
      const teamId = validatedEvent.context.teamId || this.config.general.teamId;
      if (!teamId) {
        throw new Error(
          'teamId is required for event ingestion. Set in config or event context.',
        );
      }
      // Ensure the event has teamId set (mutate for storage)
      validatedEvent.context.teamId = teamId;

      // Store raw event
      await this.store.insertEvent(validatedEvent);

      // Process into memories
      const memories = await this.processEvent(validatedEvent);
      allMemories.push(...memories);
    }

    return allMemories.length;
  }

  async query(query: string, options?: { projectId?: string; limit?: number; teamId?: string; userId?: string }) {
    return this.ragEngine.query(query, options);
  }

   async ask(question: string, options?: { projectId?: string; limit?: number; teamId?: string; userId?: string }): Promise<string> {
     const results = await this.ragEngine.query(question, options);
     if (results.length === 0) {
       return "I don't know based on the available memories.";
     }

     const context = results.map((r) => {
       const mem = r.memory;
       let text = mem.content.summary;
       if (mem.content.detail) {
         text += '\n' + mem.content.detail;
       }
       return text;
     });

     return this.ragEngine.synthesize(question, context);
   }

  private generateSummary(event: NautalisEvent): string {
    if (event.toolName && event.toolInput) {
      if (event.toolName === 'Bash' && event.toolInput.command) {
        return `Executed command: ${event.toolInput.command}`;
      }
      if (event.toolName === 'Edit' && event.toolInput.file_path) {
        return `Edited file: ${event.toolInput.file_path}`;
      }
      if (event.toolName === 'Write' && event.toolInput.file_path) {
        return `Wrote file: ${event.toolInput.file_path}`;
      }
      if (event.toolName === 'Read' && event.toolInput.file_path) {
        return `Read file: ${event.toolInput.file_path}`;
      }
    }

    if (event.type === 'error') {
      return `Error: ${event.extracted.errors.join(', ') || 'Unknown error'}`;
    }

    if (event.type === 'conversation') {
      return `Conversation with ${event.source.agentName || event.source.toolName}`;
    }

    return `${event.type} event from ${event.source.toolName}`;
  }

  private generateDetail(event: NautalisEvent): string {
    const parts: string[] = [];

    parts.push(`Tool: ${event.toolName || 'N/A'}`);
    parts.push(`Type: ${event.type}`);
    parts.push(`Files: ${event.filesInvolved.join(', ') || 'N/A'}`);

    if (event.toolInput?.command) {
      parts.push(`Command: ${event.toolInput.command}`);
    }

    if (event.toolOutput?.exitCode !== undefined) {
      parts.push(`Exit code: ${event.toolOutput.exitCode}`);
    }

    if (event.extracted.errors.length > 0) {
      parts.push(`Errors: ${event.extracted.errors.join('; ')}`);
    }

    return parts.join('\n');
  }
}
