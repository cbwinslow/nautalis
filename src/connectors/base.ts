import type { Connector, ConnectorConfig, ConnectorHealth, ConnectorMetadata } from '../types/connector.js';
import type { NautalisEvent } from '../types/event.js';
import type { AgentContext } from '../types/context.js';

export abstract class BaseConnector implements Connector {
  abstract metadata: ConnectorMetadata;
  
  async setup(_config: ConnectorConfig): Promise<void> {
    // Default: no-op
  }
  
  abstract ingest(config: ConnectorConfig): Promise<NautalisEvent[]>;
  
  async *watch(_config: ConnectorConfig): AsyncGenerator<NautalisEvent> {
    // Default: no-op
  }
  
  async inject(_context: AgentContext): Promise<void> {
    // Default: no-op
  }
  
  async health(): Promise<ConnectorHealth> {
    return {
      status: 'healthy',
      lastCheck: new Date(),
      lastIngest: null,
      eventsIngested: 0,
      errors: [],
    };
  }
}
