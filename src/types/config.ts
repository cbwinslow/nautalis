export type DatabaseDriver = 'postgres' | 'supabase';
export type EmbedProvider = 'ollama' | 'openai' | 'cohere' | 'custom';
export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  postgres?: { url: string; maxConnections?: number };
  supabase?: { projectUrl: string; serviceKey: string };
}

export interface EmbeddingConfig {
  provider: EmbedProvider;
  model: string;
  ollama?: { url: string };
  openai?: { apiKeyEnv: string; model: string };
  cohere?: { apiKeyEnv: string; model: string };
  custom?: { baseUrl: string; model: string; apiKeyEnv?: string; headers?: Record<string, string> };
}

export interface LLMConfig {
  provider: LLMProvider;
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

export interface NautalisConfig {
  general: {
    userId: string;
    teamId?: string;
  };
  database: DatabaseConfig;
  embeddings: EmbeddingConfig;
  llm: LLMConfig;
  connectors: ConnectorEntry[];
  guardrails: GuardrailsConfig;
  rules: RuleConfig[];
}

export interface RuleConfig {
  name: string;
  trigger: string;
  action: string;
  priority?: 'low' | 'medium' | 'high';
}
