import type { AgentIdentity, NautalisEvent } from './event.js';
import type { AgentContext } from './context.js';

export interface ConnectorConfig {
  enabled: boolean;
  sourceDirs: string[];
  filePattern?: string;
  parser?: 'jsonl' | 'json' | 'text' | 'custom';
  customParserCmd?: string;
  watchMode?: boolean;
  pollIntervalMs?: number;
  [key: string]: unknown;
}

export interface ConnectorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  lastIngest: Date | null;
  eventsIngested: number;
  errors: string[];
}

export interface ConnectorMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
  supportedFeatures: string[];
  requiredTools: string[];
}

export interface Connector {
  metadata: ConnectorMetadata;
  setup(config: ConnectorConfig): Promise<void>;
  ingest(config: ConnectorConfig): Promise<NautalisEvent[]>;
  watch(config: ConnectorConfig): AsyncGenerator<NautalisEvent>;
  inject(context: AgentContext): Promise<void>;
  health(): Promise<ConnectorHealth>;
}
