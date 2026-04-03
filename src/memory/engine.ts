import type { NautalisEvent } from '../types/event.js';
import type { Memory } from '../types/memory.js';
import type { Store } from '../store/interface.js';
import type { NautalisConfig } from '../types/config.js';
import { MemoryClassifier } from './classify.js';
import { DecisionExtractor } from './extract.js';
import { EmbeddingService } from './embed.js';
import { RAGEngine } from './rag.js';
import { v4 as uuidv4 } from 'uuid';
import { createSpan, recordMetric, logMessage, benchmarkOperation } from '../telemetry/api.js';
import { SPAN_NAMES, METRIC_NAMES } from '../types/telemetry.js';

export class MemoryEngine {
  private classifier: MemoryClassifier;
  private decisionExtractor: DecisionExtractor;
  private embeddingService: EmbeddingService;
  private ragEngine: RAGEngine;
  private store: Store;
  
  constructor(store: Store, config: NautalisConfig) {
    this.store = store;
    this.classifier = new MemoryClassifier();
    this.decisionExtractor = new DecisionExtractor();
    this.embeddingService = new EmbeddingService({
      baseUrl: config.embeddings.ollama?.url || 'http://localhost:11434',
      model: config.embeddings.model,
    });
    this.ragEngine = new RAGEngine(config);
  }
  
  async processEvent(event: NautalisEvent): Promise<Memory[]> {
    const span = createSpan(SPAN_NAMES.ENRICH_MEMORY, {
      'event.type': event.type,
      'event.tool': event.toolName || 'unknown',
    });
    
    try {
      const memories: Memory[] = [];
      
      // Classify the event
      const classification = this.classifier.classify(event);
      
      // Generate embedding for the event summary
      const summary = this.generateSummary(event);
      const embeddingResult = await this.embeddingService.embed(summary);
      
      // Create memory
      const memory: Memory = {
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        agentIdentity: event.source,
        context: event.context,
        classification,
        content: {
          summary,
          detail: this.generateDetail(event),
          filesInvolved: event.filesInvolved,
          commandsExec: event.toolInput?.command ? [event.toolInput.command] : [],
          errorsSeen: event.extracted.errors,
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
      const decisions = this.decisionExtractor.extract(event);
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
        await this.store.insertMemory(mem);
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
    
    for (const event of events) {
      const memories = await this.processEvent(event);
      allMemories.push(...memories);
    }
    
    return allMemories.length;
  }
  
  async query(query: string, options?: { projectId?: string; limit?: number }) {
    return this.ragEngine.query(query, options);
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
