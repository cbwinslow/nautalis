import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { ConnectorRegistry } from '@/connectors/registry.js';
import type { Connector } from '@/types/connector.js';
import type { NautalisConfig } from '@/types/config.js';

// Mock connectors
const createMockConnector = (name: string, version: string = '1.0.0'): Connector => ({
  metadata: {
    name,
    description: `Mock ${name} connector`,
    version,
    supportedFeatures: ['ingest', 'setup'],
    requiredTools: [],
  },
  setup: vi.fn().mockResolvedValue(undefined),
  ingest: vi.fn().mockResolvedValue([]),
  watch: vi.fn(),
  inject: vi.fn().mockResolvedValue(undefined),
  health: vi.fn().mockResolvedValue({
    status: 'healthy',
    lastCheck: new Date(),
    lastIngest: null,
    eventsIngested: 0,
    errors: [],
  }),
});

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = new ConnectorRegistry();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a connector by name', () => {
      const connector = createMockConnector('test-connector');
      registry.register(connector);

      expect(registry.get('test-connector')).toBe(connector);
    });

    it('should allow multiple connectors', () => {
      const connector1 = createMockConnector('connector-a');
      const connector2 = createMockConnector('connector-b');

      registry.register(connector1);
      registry.register(connector2);

      expect(registry.get('connector-a')).toBe(connector1);
      expect(registry.get('connector-b')).toBe(connector2);
    });

    it('should replace existing connector with same name', () => {
      const oldConnector = createMockConnector('test', '1.0');
      const newConnector = createMockConnector('test', '2.0');

      registry.register(oldConnector);
      registry.register(newConnector);

      expect(registry.get('test')).toBe(newConnector);
    });

    it('should return all registered connectors', () => {
      const connector1 = createMockConnector('a');
      const connector2 = createMockConnector('b');
      const connector3 = createMockConnector('c');

      registry.register(connector1);
      registry.register(connector2);
      registry.register(connector3);

      const all = registry.getAll();
      expect(all.size).toBe(3);
      expect(all.has('a')).toBe(true);
      expect(all.has('b')).toBe(true);
      expect(all.has('c')).toBe(true);
    });
  });

  describe('getEnabled', () => {
    beforeEach(() => {
      // Register some test connectors
      registry.register(createMockConnector('claude-code'));
      registry.register(createMockConnector('kilo-code'));
      registry.register(createMockConnector('filesystem'));
    });

    it('should return enabled connectors with their configs', () => {
      const configs: NautalisConfig['connectors'] = [
        { type: 'claude-code', enabled: true, sourceDirs: [] },
        { type: 'kilo-code', enabled: true, sourceDirs: [] },
        { type: 'filesystem', enabled: false, sourceDirs: [] },
        { type: 'nonexistent', enabled: true, sourceDirs: [] }, // Should be skipped
      ];

      const enabled = registry.getEnabled(configs);

      expect(enabled.length).toBe(2);
      expect(enabled[0].connector.metadata.name).toBe('claude-code');
      expect(enabled[1].connector.metadata.name).toBe('kilo-code');
    });

    it('should skip connectors with missing implementations', () => {
      const configs: NautalisConfig['connectors'] = [
        { type: 'nonexistent', enabled: true, sourceDirs: [] },
      ];

      const enabled = registry.getEnabled(configs);

      expect(enabled.length).toBe(0);
    });

    it('should merge connector config correctly', () => {
      const configs: NautalisConfig['connectors'] = [
        {
          type: 'claude-code',
          enabled: true,
          sourceDirs: ['/path/to/dir'],
          filePattern: '**/*.json',
        },
      ];

      const enabled = registry.getEnabled(configs);
      const { config } = enabled[0];

      expect(config.enabled).toBe(true);
      expect(config.sourceDirs).toEqual(['/path/to/dir']);
      expect(config.filePattern).toBe('**/*.json');
    });
  });

  describe('setupAll', () => {
    beforeEach(() => {
      registry.register(createMockConnector('test-connector'));
      registry.register(createMockConnector('another-connector'));
    });

    it('should call setup on all enabled connectors', async () => {
      const configs: NautalisConfig['connectors'] = [
        { type: 'test-connector', enabled: true, sourceDirs: [] },
        { type: 'another-connector', enabled: true, sourceDirs: [] },
      ];

      await registry.setupAll(configs);

      const setupCalls = (registry.getAll().get('test-connector')?.setup as any).mock.calls.length;
      expect(setupCalls).toBeGreaterThan(0);
    });

    it('should skip disabled connectors', async () => {
      const configs: NautalisConfig['connectors'] = [
        { type: 'test-connector', enabled: false, sourceDirs: [] },
      ];

      await registry.setupAll(configs);

      expect((registry.getAll().get('test-connector')?.setup as any).mock.calls.length).toBe(0);
    });

    it('should continue even if some connectors fail', async () => {
      const failingConnector: Connector = {
        ...createMockConnector('failing-connector'),
        setup: vi.fn().mockRejectedValue(new Error('Setup failed')),
      };
      const workingConnector: Connector = {
        ...createMockConnector('working-connector'),
        setup: vi.fn().mockResolvedValue(undefined),
      };

      registry.register(failingConnector);
      registry.register(workingConnector);

      const configs: NautalisConfig['connectors'] = [
        { type: 'failing-connector', enabled: true, sourceDirs: [] },
        { type: 'working-connector', enabled: true, sourceDirs: [] },
      ];

      // Should not throw
      await expect(registry.setupAll(configs)).resolves.not.toThrow();

      // Both were attempted
      expect(failingConnector.setup).toHaveBeenCalled();
      expect(workingConnector.setup).toHaveBeenCalled();
    });
  });

  describe('ingestAll', () => {
    beforeEach(() => {
      registry.register(createMockConnector('test-connector'));
    });

    it('should call ingest on enabled connectors and collect events', async () => {
      const mockEvents = [
        {
          eventId: 'evt_1',
          timestamp: new Date(),
          source: {} as any,
          project: {} as any,
          type: 'command',
          extracted: { errors: [], topics: [] },
          filesInvolved: [],
        },
        {
          eventId: 'evt_2',
          timestamp: new Date(),
          source: {} as any,
          project: {} as any,
          type: 'decision',
          extracted: { errors: [], topics: [] },
          filesInvolved: [],
        },
      ];

      const connector = registry.getAll().get('test-connector') as Connector & { ingest: any };
      connector.ingest = vi.fn().mockResolvedValue(mockEvents);

      const configs: NautalisConfig['connectors'] = [
        { type: 'test-connector', enabled: true, sourceDirs: [] },
      ];

      const events = await registry.ingestAll(configs);

      expect(events.length).toBe(2);
      expect(events[0].eventId).toBe('evt_1');
      expect(events[1].eventId).toBe('evt_2');
    });

    it('should continue if a connector ingest fails', async () => {
      const failingConnector: Connector = {
        ...createMockConnector('failing-connector'),
        ingest: vi.fn().mockRejectedValue(new Error('Ingest failed')),
      };
      const workingConnector: Connector = {
        ...createMockConnector('working-connector'),
        ingest: vi.fn().mockResolvedValue([
          {
            eventId: 'evt_1',
            timestamp: new Date(),
            source: {} as any,
            project: {} as any,
            type: 'command',
            extracted: { errors: [], topics: [] },
            filesInvolved: [],
          },
        ]),
      };

      registry.register(failingConnector);
      registry.register(workingConnector);

      const configs: NautalisConfig['connectors'] = [
        { type: 'failing-connector', enabled: true, sourceDirs: [] },
        { type: 'working-connector', enabled: true, sourceDirs: [] },
      ];

      const events = await registry.ingestAll(configs);

      // Still got events from working connector
      expect(events.length).toBe(1);
      expect(events[0].eventId).toBe('evt_1');
    });
  });

  describe('healthCheckAll', () => {
    it('should aggregate health status from all enabled connectors', async () => {
      const healthyConnector: Connector = {
        ...createMockConnector('healthy'),
        health: vi.fn().mockResolvedValue({
          status: 'healthy',
          lastCheck: new Date(),
          lastIngest: new Date(),
          eventsIngested: 100,
          errors: [],
        }),
      };
      const degradedConnector: Connector = {
        ...createMockConnector('degraded'),
        health: vi.fn().mockResolvedValue({
          status: 'degraded',
          lastCheck: new Date(),
          lastIngest: new Date(),
          eventsIngested: 10,
          errors: ['Connection warning'],
        }),
      };

      registry.register(healthyConnector);
      registry.register(degradedConnector);

      const configs: NautalisConfig['connectors'] = [
        { type: 'healthy', enabled: true, sourceDirs: [] },
        { type: 'degraded', enabled: true, sourceDirs: [] },
      ];

      const healthMap = registry.healthCheckAll(configs);

      expect(healthMap.has('healthy')).toBe(true);
      expect(healthMap.get('healthy')?.status).toBe('healthy');
      expect(healthMap.get('degraded')?.status).toBe('degraded');
    });
  });
});
