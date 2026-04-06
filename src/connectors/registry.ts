import type { Connector, ConnectorConfig } from '../types/connector.js';
import type { NautalisConfig } from '../types/config.js';
import type { NautalisEvent } from '../types/event.js';
import { logMessage, createSpan, recordMetric } from '../telemetry/api.js';
import { METRIC_NAMES } from '../types/telemetry.js';

class ConnectorRegistry {
  private connectors = new Map<string, Connector>();
  private configs = new Map<string, ConnectorConfig>();

  register(connector: Connector): void {
    this.connectors.set(connector.metadata.name, connector);
    logMessage(
      'info',
      `Registered connector: ${connector.metadata.name} v${connector.metadata.version}`,
    );
  }

  setConfig(name: string, config: ConnectorConfig): void {
    this.configs.set(name, config);
  }

  get(name: string): Connector | undefined {
    return this.connectors.get(name);
  }

  getAll(): Map<string, Connector> {
    return new Map(this.connectors);
  }

  getEnabled(
    configs: NautalisConfig['connectors'],
  ): Array<{ connector: Connector; config: ConnectorConfig }> {
    const result: Array<{ connector: Connector; config: ConnectorConfig }> = [];

    for (const entry of configs) {
      if (!entry.enabled) continue;

      const connector = this.connectors.get(entry.type);
      if (!connector) {
        logMessage('warn', `Connector not found: ${entry.type}`);
        continue;
      }

      const config: ConnectorConfig = { ...entry };

      result.push({ connector, config });
    }

    return result;
  }

  async setupAll(configs: NautalisConfig['connectors']): Promise<void> {
    const enabled = this.getEnabled(configs);
    const span = createSpan('nautalis.connector.setup_all', { connector_count: enabled.length });

    try {
      for (const { connector, config } of enabled) {
        try {
          await connector.setup(config);
          logMessage('info', `Setup complete for connector: ${connector.metadata.name}`);
        } catch (error) {
          logMessage('error', `Failed to setup connector ${connector.metadata.name}: ${error}`);
        }
      }
    } finally {
      span.end();
    }
  }

  async ingestAll(configs: NautalisConfig['connectors']): Promise<NautalisEvent[]> {
    const enabled = this.getEnabled(configs);
    const span = createSpan('nautalis.connector.ingest_all', { connector_count: enabled.length });
    const allEvents: NautalisEvent[] = [];

    try {
      for (const { connector, config } of enabled) {
        try {
          const events = await connector.ingest(config);
          allEvents.push(...events);
          logMessage('info', `Ingested ${events.length} events from ${connector.metadata.name}`);
        } catch (error) {
          logMessage('error', `Failed to ingest from ${connector.metadata.name}: ${error}`);
        }
      }
    } finally {
      span.end();
    }

    // Record total events ingested metric (also recorded per event later)
    recordMetric(METRIC_NAMES.EVENTS_INGESTED, allEvents.length, { source: 'connectors' });

    return allEvents;
  }

  async watchAll(configs: NautalisConfig['connectors']): Promise<AsyncGenerator<NautalisEvent>> {
    const enabled = this.getEnabled(configs);
    const generators: AsyncGenerator<NautalisEvent>[] = [];

    for (const { connector, config } of enabled) {
      if (connector.watch) {
        generators.push(connector.watch(config));
      }
    }

    return this.mergeGenerators(generators);
  }

  async healthAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const [name, connector] of this.connectors.entries()) {
      try {
        const health = await connector.health();
        results[name] = {
          status: health.status,
          lastCheck: health.lastCheck,
          lastIngest: health.lastIngest,
          eventsIngested: health.eventsIngested,
          error: null,
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          lastCheck: new Date(),
          lastIngest: null,
          eventsIngested: 0,
          error: String(error),
        };
      }
    }
    return results;
  }

  private async *mergeGenerators<T>(
    generators: AsyncGenerator<T>[],
  ): AsyncGenerator<T> {
    const iterators = generators.map((g) => g[Symbol.asyncIterator]());
    while (true) {
      let doneCount = 0;
      for (const iterator of iterators) {
        const { value, done } = await iterator.next();
        if (done) {
          doneCount++;
        } else if (value !== undefined) {
          yield value;
        }
      }
      if (doneCount === iterators.length) break;
    }
  }
}

export const connectorRegistry = new ConnectorRegistry();

export function registerConnector(connector: Connector): void {
  connectorRegistry.register(connector);
}

export function getConnector(name: string): Connector | undefined {
  return connectorRegistry.get(name);
}

export function getAllConnectors(): Map<string, Connector> {
  return connectorRegistry.getAll();
}

export async function setupConnectors(config: NautalisConfig): Promise<void> {
  await connectorRegistry.setupAll(config.connectors);
}

export async function ingestConnectors(config: NautalisConfig): Promise<NautalisEvent[]> {
  return connectorRegistry.ingestAll(config.connectors);
}

export async function watchConnectors(config: NautalisConfig): Promise<AsyncGenerator<NautalisEvent>> {
  return connectorRegistry.watchAll(config.connectors);
}

export async function healthConnectors(): Promise<Record<string, any>> {
  return connectorRegistry.healthAll();
}
