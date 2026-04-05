import { BaseProvider, PROVIDER_CAPABILITIES } from './base.js';
import type { ProviderConfig } from '../types/config.js';
import { EmbeddingService } from '../memory/embed.js';
import { logMessage } from '../telemetry/api.js';

export class CohereProvider extends BaseProvider {
  capabilities = PROVIDER_CAPABILITIES.cohere;

  constructor(private config: ProviderConfig) {
    super();
  }

  createEmbeddingService(overrides?: Partial<any>): EmbeddingService {
    const baseUrl = this.config.baseUrl || 'https://api.cohere.com/v1';
    const model = this.config.model || 'embed-english-v3.0';
    const apiKey = this.getApiKey();

    return new EmbeddingService({
      baseUrl,
      model,
      apiKey,
      endpointPath: '/embed',
      requestTransform: (body) => ({
        model: body.model,
        text: body.input,
      }),
      responseTransform: (data) => ({
        embedding: data.embeddings[0],
      }),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(overrides?.headers || {}),
      },
      ...overrides,
    });
  }

  createLLM(overrides?: Partial<any>): never {
    throw new Error('CohereProvider does not support LLM generation. Use a different provider for LLM.');
  }

  private getApiKey(): string {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }
    const apiKeyEnv = this.config.apiKeyEnv || 'COHERE_API_KEY';
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Cohere API key not found. Set ${apiKeyEnv} environment variable.`);
    }
    return apiKey;
  }
}
