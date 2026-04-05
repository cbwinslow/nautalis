import { BaseProvider, PROVIDER_CAPABILITIES } from './base.js';
import type { ProviderConfig } from '../types/config.js';
import { ProviderRegistry } from './registry.js';

export class CompositeProvider extends BaseProvider {
  capabilities = PROVIDER_CAPABILITIES.composite;

  private innerProviders: BaseProvider[];

  constructor(config: ProviderConfig & { providers: string[] }, registry: ProviderRegistry) {
    super();
    this.innerProviders = config.providers.map(name => {
      try {
        return registry.getProvider(name);
      } catch (err) {
        throw new Error(`CompositeProvider: provider "${name}" not found or invalid`);
      }
    });
  }

  private selectProvider(capability: 'embedding' | 'llm'): BaseProvider {
    for (const provider of this.innerProviders) {
      if (provider.supports(capability)) {
        return provider;
      }
    }
    throw new Error(`CompositeProvider: no available provider supports ${capability}`);
  }

  createEmbeddingService(overrides?: Partial<any>): any {
    const provider = this.selectProvider('embedding');
    return provider.createEmbeddingService(overrides);
  }

  createLLM(overrides?: Partial<any>): any {
    const provider = this.selectProvider('llm');
    return provider.createLLM(overrides);
  }
}
