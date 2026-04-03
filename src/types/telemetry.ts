export type TelemetrySignal = 'trace' | 'metric' | 'log';

export interface NautalisSpan {
  name: string;
  attributes: Record<string, string | number | boolean>;
  startTime: Date;
  endTime?: Date;
  status: 'ok' | 'error' | 'unset';
  parentId?: string;
  traceId: string;
  spanId: string;
}

export interface NautalisMetric {
  name: string;
  value: number;
  unit: string;
  type: 'counter' | 'histogram' | 'gauge' | 'updowncounter';
  attributes: Record<string, string | number | boolean>;
  timestamp: Date;
}

export interface NautalisLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  attributes: Record<string, unknown>;
  timestamp: Date;
  traceId?: string;
  spanId?: string;
}

export const SPAN_NAMES = {
  INGEST_EVENT: 'nautalis.ingest.event',
  ENRICH_MEMORY: 'nautalis.memory.enrich',
  STORE_MEMORY: 'nautalis.memory.store',
  QUERY_MEMORY: 'nautalis.memory.query',
  EMBED_TEXT: 'nautalis.embed.text',
  CONNECTOR_SETUP: 'nautalis.connector.setup',
  CONNECTOR_INGEST: 'nautalis.connector.ingest',
  CONNECTOR_WATCH: 'nautalis.connector.watch',
  CONNECTOR_INJECT: 'nautalis.connector.inject',
  RAG_RETRIEVE: 'nautalis.rag.retrieve',
  RAG_SYNTHESIZE: 'nautalis.rag.synthesize',
  CONTEXT_BUILD: 'nautalis.context.build',
  CONTEXT_INJECT: 'nautalis.context.inject',
} as const;

export const METRIC_NAMES = {
  EVENTS_INGESTED: 'nautalis.events.ingested',
  MEMORIES_STORED: 'nautalis.memories.stored',
  MEMORIES_QUERIED: 'nautalis.memories.queried',
  EMBEDDINGS_GENERATED: 'nautalis.embeddings.generated',
  CONNECTOR_ERRORS: 'nautalis.connector.errors',
  QUERY_LATENCY: 'nautalis.query.latency_ms',
  MEMORY_COUNT: 'nautalis.memory.total_count',
  ACTIVE_SESSIONS: 'nautalis.sessions.active',
} as const;
