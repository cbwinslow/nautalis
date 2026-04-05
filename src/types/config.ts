export type DatabaseDriver = 'postgres' | 'supabase';

// All possible provider types (union)
export type ProviderType = 'ollama' | 'openai' | 'anthropic' | 'cohere' | 'custom';
// Embedding providers (which support embeddings)
export type EmbedProvider = 'ollama' | 'openai' | 'cohere' | 'custom';
// LLM providers (which support chat/completion)
export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  postgres?: { url: string; maxConnections?: number };
  supabase?: { projectUrl: string; serviceKey: string };
}

// Provider configuration for the providers registry
export interface ProviderConfig {
  type: ProviderType;
  // Common fields
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string; // read API key from this env var
  apiKey?: string; // direct API key (less secure, for testing)
  headers?: Record<string, string>;
  // Ollama-specific
  url?: string; // alias for baseUrl
  // OpenAI-specific
  organization?: string;
  project?: string;
  // Custom endpoint path
  endpointPath?: string;
  // Request/response transforms (advanced)
  requestTransform?: (body: any) => any;
  responseTransform?: (data: any) => any;
}

// Named providers map
export interface ProvidersConfig {
  [name: string]: ProviderConfig;
}

export interface EmbeddingConfig {
  provider: EmbedProvider; // can be a provider name if providers map is defined, else default provider type
  model: string;
  // Per-provider configs (legacy, used when no providers map)
  ollama?: { url: string };
  openai?: { apiKeyEnv: string; model: string };
  cohere?: { apiKeyEnv: string; model: string };
  custom?: { baseUrl: string; model: string; apiKeyEnv?: string; headers?: Record<string, string> };
}

export interface LLMConfig {
  provider: LLMProvider; // can be a provider name if providers map is defined, else default provider type
  model: string;
  ollama?: { url: string };
  openai?: { apiKeyEnv: string; model: string };
  anthropic?: { apiKeyEnv: string; model: string };
  custom?: { baseUrl: string; model: string; apiKeyEnv?: string; headers?: Record<string, string> };
}

export interface GuardrailsConfig {
  piiDetection: boolean;
  secretDetection: boolean;
  maxContextLines: number;
  minRelevanceScore: number;
}

export interface ConnectorEntry {
  type: string;
  enabled: boolean;
  sourceDirs: string[];
  [key: string]: unknown;
}

export interface ProviderCapabilities {
  embeddings: boolean; // supports embedding generation
  llm: boolean; // supports LLM completion/chat
}

export const PROVIDER_CAPABILITIES: Record<ProviderType, ProviderCapabilities> = {
  ollama: { embeddings: true, llm: true },
  openai: { embeddings: true, llm: true },
  anthropic: { embeddings: false, llm: true },
  cohere: { embeddings: true, llm: false },
  custom: { embeddings: true, llm: true }, // assume both, depends on implementation
};

export interface NautalisConfig {
  general: {
    userId: string;
    teamId?: string;
  };
  database: DatabaseConfig;
  embeddings: EmbeddingConfig;
  llm: LLMConfig;
  rag?: {
    indexPath?: string;
  };
  connectors: ConnectorEntry[];
  guardrails: GuardrailsConfig;
  rules: RuleConfig[];
  // New: provider registry for multi-provider support
  providers?: ProvidersConfig;
}

export interface RuleConfig {
  name: string;
  trigger: string;
  action: string;
  priority?: 'low' | 'medium' | 'high';
}
