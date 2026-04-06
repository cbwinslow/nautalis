import { BaseProvider, PROVIDER_CAPABILITIES } from './base.js';
import type { ProviderConfig } from '../types/config.js';
import { logMessage } from '../telemetry/api.js';
import { Anthropic } from 'llamaindex';

export class AnthropicProvider extends BaseProvider {
  capabilities = PROVIDER_CAPABILITIES.anthropic;

  constructor(private config: ProviderConfig) {
    super();
  }

   createLLM(overrides?: Partial<any>): any {
     const baseUrl = this.config.baseUrl || 'https://api.anthropic.com';
     const model = this.config.model || 'claude-3-5-sonnet-20241022';
     const apiKey = this.getApiKey();

     return new Anthropic({
       baseUrl,
       model,
       apiKey,
       ...overrides,
     } as any);
   }

  createEmbeddingService(overrides?: Partial<any>): never {
    throw new Error('AnthropicProvider does not support embeddings. Use a different provider for embeddings.');
  }

  private getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }
    const apiKeyEnv = this.config.apiKeyEnv || 'ANTHROPIC_API_KEY';
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Anthropic API key not found. Set ${apiKeyEnv} environment variable.`);
    }
    return apiKey;
  }
}
