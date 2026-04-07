import { describe, it, expect, beforeEach } from 'bun:test';
import { KiloCodeConnector } from '../../src/connectors/kilo-code.js';
import type { ConnectorConfig } from '../../src/types/connector.js';
import { join } from 'path';

describe('KiloCodeConnector', () => {
  let connector: KiloCodeConnector;
  let config: ConnectorConfig;

  beforeEach(() => {
    connector = new KiloCodeConnector();
    config = {
      type: 'kilo_code',
      enabled: true,
      sourceDirs: [join(process.cwd(), 'test', 'fixtures')],
    };
  });

  it('should parse a valid Kilo Code session file', async () => {
    const events = await connector.ingest(config);
    // The fixture has 6 events
    expect(events.length).toBeGreaterThan(0);
  });

  it('should generate valid NautalisEvent objects', async () => {
    const events = await connector.ingest(config);
    for (const event of events) {
      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.source).toBeDefined();
      expect(event.source?.toolName).toBe('kilo_code');
      expect(event.source?.agentName).toBe('Kilo Code');
      expect(['tool_use', 'file_edit', 'command', 'decision', 'session_start', 'session_end']).toContain(event.type);
    }
  });

  it('should map tool_call to tool_use with correct fields', async () => {
    const events = await connector.ingest(config);
    const toolUseEvents = events.filter(e => e.type === 'tool_use');
    expect(toolUseEvents.length).toBeGreaterThan(0);
    const toolEvent = toolUseEvents[0];
    expect(toolEvent.toolName).toBe('ReadFile');
    expect(toolEvent.toolInput).toEqual({ path: '/home/user/project/README.md' });
    expect(toolEvent.toolOutput).toEqual({ content: '# My Project\nThis is a test.' });
  });

  it('should map file_edit correctly', async () => {
    const events = await connector.ingest(config);
    const fileEditEvents = events.filter(e => e.type === 'file_edit');
    expect(fileEditEvents.length).toBeGreaterThan(0);
    const fe = fileEditEvents[0];
    expect(fe.toolName).toBe('file_edit');
    expect(fe.filesInvolved).toContain('/home/user/project/README.md');
    expect(fe.toolInput).toMatchObject({ file_path: '/home/user/project/README.md' });
  });

  it('should map command correctly', async () => {
    const events = await connector.ingest(config);
    const commandEvents = events.filter(e => e.type === 'command');
    expect(commandEvents.length).toBeGreaterThan(0);
    const cmd = commandEvents[0];
    expect(cmd.toolName).toBe('shell');
    expect(cmd.toolInput).toEqual({ command: 'git status' });
    expect(cmd.toolOutput).toMatchObject({ exitCode: 0, stdout: expect.stringContaining('On branch main') });
  });

  it('should map lesson to decision', async () => {
    const events = await connector.ingest(config);
    const decisionEvents = events.filter(e => e.type === 'decision');
    expect(decisionEvents.length).toBeGreaterThan(0);
    const decision = decisionEvents[0];
    expect(decision.extracted.decisions).toContain('Use functions for reuse');
    expect(decision.raw.title).toBe('Use functions for reuse');
  });

  it('should include session_start and session_end', async () => {
    const events = await connector.ingest(config);
    const startEvents = events.filter(e => e.type === 'session_start');
    const endEvents = events.filter(e => e.type === 'session_end');
    expect(startEvents.length).toBeGreaterThan(0);
    expect(endEvents.length).toBeGreaterThan(0);
  });
});
