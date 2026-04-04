import { BaseProvider, PROVIDER_CAPABILITIES } from './base.js';
import type { ProviderConfig } from '../types/config.js';
import { EmbeddingService } from '../memory/embed.js';
import { OpenAI } from 'llamaindex';

export class OpenAIProvider extends BaseProvider {
  capabilities = PROVIDER_CAPABILITIES.openai;
  
  constructor(private config: ProviderConfig) {
    super();
  }

  createEmbeddingService(overrides?: Partial<any>): EmbeddingService {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const model = this.config.model || 'text-embedding-ada-002';
    const apiKey = this.config.apiKey || (this.config.apiKeyEnv ? process.env[this.config.apiKeyEnv] : undefined);

    if (!apiKey) {
      throw new Error(`OpenAI API key not found. Set apiKey or env var ${this.config.apiKeyEnv || 'OPENAI_API_KEY'}`);
    }

    return new EmbeddingService({
      baseUrl,
      model,
      apiKey,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...this.config.headers,
      },
      endpointPath: '/embeddings',
      requestTransform: (body) => ({
        model: body.model,
        input: body.prompt,
      }),
      responseTransform: (data) => ({
        embedding: data.data?.[0]?.embedding || data.embedding,
      }),
      ...overrides,
    });
  }

  createLLM(overrides?: Partial<any>): any {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const model = this.config.model || 'gpt-3.5-turbo';
    const apiKey = this.config.apiKey || (this.config.apiKeyEnv ? process.env[this.config.apiKeyEnv] : undefined);

    if (!apiKey) {
      throw new Error(`OpenAI API key not found. Set apiKey or env var ${this.config.apiKeyEnv || 'OPENAI_API_KEY'}`);
    }

    return new OpenAI({
      baseUrl,
      apiKey,
      model,
      organization: this.config.organization,
      project: this.config.project,
      ...overrides,
    });
  }
}
