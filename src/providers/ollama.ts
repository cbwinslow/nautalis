import { BaseProvider, PROVIDER_CAPABILITIES } from './base.js';
import type { ProviderConfig } from '../types/config.js';
import { EmbeddingService } from '../memory/embed.js';
import { logMessage } from '../telemetry/api.js';
import { Ollama } from 'llamaindex';

export class OllamaProvider extends BaseProvider {
  capabilities = PROVIDER_CAPABILITIES.ollama;
  
  constructor(private config: ProviderConfig) {
    super();
  }

  createEmbeddingService(overrides?: Partial<any>): EmbeddingService {
    const baseUrl = this.config.url || this.config.baseUrl || 'http://localhost:11434';
    const model = this.config.model || 'nomic-embed-text';

    return new EmbeddingService({
      baseUrl,
      model,
      ...overrides,
    });
  }

  createLLM(overrides?: Partial<any>): any {
    const baseUrl = this.config.url || this.config.baseUrl || 'http://localhost:11434';
    const model = this.config.model || 'qwen2.5:3b';

    return new Ollama({
      baseUrl,
      model,
      ...overrides,
    });
  }
}
