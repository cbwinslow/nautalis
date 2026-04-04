import type { ProviderConfig } from '../types/config.js';
import { BaseProvider } from './base.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
// Others not yet implemented

export class ProviderRegistry {
  private providers = new Map<string, BaseProvider>();

  constructor(providersConfig?: Record<string, ProviderConfig>) {
    if (providersConfig) {
      for (const [name, config] of Object.entries(providersConfig)) {
        this.register(name, this.createProviderFromConfig(config));
      }
    }
  }

  private createProviderFromConfig(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      case 'ollama':
        return new OllamaProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'custom':
        // TODO: Implement CustomProvider
        throw new Error('Custom provider not implemented yet');
      case 'anthropic':
        throw new Error('Anthropic provider not implemented yet');
      case 'cohere':
        throw new Error('Cohere provider not implemented yet');
      default:
        throw new Error(`Unknown provider type: ${(config as any).type}`);
    }
  }

  register(name: string, provider: BaseProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: string): BaseProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }
    return provider;
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}
