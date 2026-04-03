import type { Connector, ConnectorConfig } from '../types/connector.js';
import type { NautalisConfig } from '../types/config.js';
import type { NautalisEvent } from '../types/event.js';
import { logMessage } from '../telemetry/api.js';

class ConnectorRegistry {
  private connectors = new Map<string, Connector>();
  private configs = new Map<string, ConnectorConfig>();
  
  register(connector: Connector): void {
    this.connectors.set(connector.metadata.name, connector);
    logMessage('info', `Registered connector: ${connector.metadata.name} v${connector.metadata.version}`);
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
  
  getEnabled(configs: NautalisConfig['connectors']): Array<{ connector: Connector; config: ConnectorConfig }> {
    const result: Array<{ connector: Connector; config: ConnectorConfig }> = [];
    
    for (const entry of configs) {
      if (!entry.enabled) continue;
      
      const connector = this.connectors.get(entry.type);
      if (!connector) {
        logMessage('warn', `Connector not found: ${entry.type}`);
        continue;
      }
      
      const config: ConnectorConfig = {
        enabled: entry.enabled,
        sourceDirs: entry.sourceDirs,
        filePattern: entry.filePattern,
        parser: entry.parser as ConnectorConfig['parser'],
        customParserCmd: entry.customParserCmd,
        ...entry,
      };
      
      result.push({ connector, config });
    }
    
    return result;
  }
  
  async setupAll(configs: NautalisConfig['connectors']): Promise<void> {
    const enabled = this.getEnabled(configs);
    
    for (const { connector, config } of enabled) {
      try {
        await connector.setup(config);
        logMessage('info', `Setup complete for connector: ${connector.metadata.name}`);
      } catch (error) {
        logMessage('error', `Failed to setup connector ${connector.metadata.name}: ${error}`);
      }
    }
  }
  
  async ingestAll(configs: NautalisConfig['connectors']): Promise<NautalisEvent[]> {
    const enabled = this.getEnabled(configs);
    const allEvents: NautalisEvent[] = [];
    
    for (const { connector, config } of enabled) {
      try {
        const events = await connector.ingest(config);
        allEvents.push(...events);
        logMessage('info', `Ingested ${events.length} events from ${connector.metadata.name}`);
      } catch (error) {
        logMessage('error', `Failed to ingest from ${connector.metadata.name}: ${error}`);
      }
    }
    
    return allEvents;
  }
  
  async watchAll(configs: NautalisConfig['connectors']): Promise<AsyncGenerator<NautalisEvent>> {
    const enabled = this.getEnabled(configs);
    const generators: AsyncGenerator<NautalisEvent>[] = [];
    
    for (const { connector, config } of enabled) {
      if (config.watchMode) {
        generators.push(connector.watch(config));
      }
    }
    
    return mergeAsyncGenerators(generators);
  }
}

async function* mergeAsyncGenerators<T>(generators: AsyncGenerator<T>[]): AsyncGenerator<T> {
  const iterators = generators.map(g => g[Symbol.asyncIterator]());
  let active = iterators.length;
  
  while (active > 0) {
    for (let i = 0; i < iterators.length; i++) {
      const result = await iterators[i].next();
      if (result.done) {
        active--;
        iterators.splice(i, 1);
        i--;
      } else {
        yield result.value;
      }
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
