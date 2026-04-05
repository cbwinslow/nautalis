import type { EmbeddingOptions } from '../memory/embed.js';
import type { LLM as LlamaLLM } from 'llamaindex';

export interface ProviderCapabilities {
  embeddings: boolean;
  llm: boolean;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  ollama: { embeddings: true, llm: true },
  openai: { embeddings: true, llm: true },
  anthropic: { embeddings: false, llm: true },
  cohere: { embeddings: true, llm: false },
  custom: { embeddings: true, llm: true },
  composite: { embeddings: true, llm: true }, // delegates to inner providers
};

export abstract class BaseProvider {
  abstract capabilities: ProviderCapabilities;
  
  abstract createEmbeddingService(overrides?: Partial<any>): any; // will return EmbeddingService
  abstract createLLM(overrides?: Partial<any>): LlamaLLM | null;
  
  supports(type: 'embedding' | 'llm'): boolean {
    return type === 'embedding' ? this.capabilities.embeddings : this.capabilities.llm;
  }
}
