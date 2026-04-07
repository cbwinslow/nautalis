import { BaseConnector } from './base.js';
import type { ConnectorConfig, ConnectorHealth, ConnectorMetadata } from '../types/connector.js';
import type { NautalisEvent, EventType } from '../types/event.js';
import type { AgentContext } from '../types/context.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fsSync from 'fs';
import { logMessage } from '../telemetry/api.js';

export class CursorConnector extends BaseConnector {
  metadata: ConnectorMetadata = {
    name: 'cursor',
    description: 'Cursor — IDE-integrated AI pair programmer',
    version: '1.0.0',
    supportedFeatures: ['sessions', 'completions'],
    requiredTools: ['cursor'],
  };

  private eventsIngested = 0;
  private lastIngest: Date | null = null;

  async ingest(config: ConnectorConfig): Promise<NautalisEvent[]> {
    const events: NautalisEvent[] = [];

    for (const sourceDir of config.sourceDirs) {
      const expandedDir = sourceDir.replace(/^~/, os.homedir());

      if (!fsSync.existsSync(expandedDir)) {
        logMessage('warn', `Cursor session directory not found: ${expandedDir}`);
        continue;
      }

      const entries = await fs.readdir(expandedDir);

      for (const entry of entries) {
        if (entry.endsWith('.json') || entry.endsWith('.jsonl')) {
          const filePath = path.join(expandedDir, entry);
          const sessionEvents = await this.parseSessionFile(filePath);
          events.push(...sessionEvents);
        }
      }
    }

    this.eventsIngested += events.length;
    this.lastIngest = new Date();

    return events;
  }

  async inject(context: AgentContext): Promise<void> {
    logMessage('info', 'Context injection not supported for Cursor');
  }

  async health(): Promise<ConnectorHealth> {
    return {
      status: 'healthy',
      lastCheck: new Date(),
      lastIngest: this.lastIngest,
      eventsIngested: this.eventsIngested,
      errors: [],
    };
  }

  private async parseSessionFile(filePath: string): Promise<NautalisEvent[]> {
    const events: NautalisEvent[] = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const event = this.transformEvent(data, filePath);
          if (event) {
            events.push(event);
          }
        } catch (parseError) {
          logMessage('warn', `Failed to parse Cursor session line in ${filePath}: ${parseError}`);
        }
      }
    } catch (error) {
      logMessage('error', `Failed to read Cursor session file ${filePath}: ${error}`);
    }

    return events;
  }

  private transformEvent(data: any, sourceFile: string): NautalisEvent | null {
    const type = data.type;
    if (!type) {
      logMessage('warn', 'Cursor event missing type field');
      return null;
    }

    const sessionId = data.session_id || '';
    const cwd = data.cwd || process.cwd();

    let eventType: EventType;
    let toolName: string | undefined;
    let toolInput: any = undefined;
    let toolOutput: any = undefined;
    let filesInvolved: string[] = [];
    let extractedDecisions: string[] = [];

    // Cursor event types (assumed similar to Kilo for simplicity)
    switch (type) {
      case 'completion':
        eventType = 'tool_use';
        toolName = 'completion';
        toolInput = { prompt: data.prompt };
        toolOutput = { completion: data.completion };
        break;
      case 'chat':
        eventType = 'conversation';
        toolName = 'chat';
        toolInput = { message: data.message };
        toolOutput = { response: data.response };
        break;
      case 'edit':
        eventType = 'file_edit';
        toolName = 'edit';
        if (data.file_path) {
          filesInvolved = [data.file_path];
        }
        toolInput = { file_path: data.file_path, old_content: data.old_content, new_content: data.new_content };
        toolOutput = { diff: data.diff };
        break;
      case 'command':
        eventType = 'command';
        toolName = 'shell';
        toolInput = { command: data.command };
        toolOutput = { exitCode: data.exit_code, stdout: data.stdout, stderr: data.stderr };
        break;
      case 'session_start':
        eventType = 'session_start';
        toolName = 'session';
        break;
      case 'session_end':
        eventType = 'session_end';
        toolName = 'session';
        break;
      default:
        // Treat unknown as conversation
        eventType = 'conversation';
        toolName = 'cursor';
        toolInput = { raw: data };
        break;
    }

    const now = new Date();
    const timestamp = data.timestamp ? new Date(data.timestamp) : now;

    const event: NautalisEvent = {
      eventId: data.event_id || uuidv4(),
      timestamp,
      source: {
        toolName: 'cursor',
        toolVersion: data.tool_version || '0.45.0',
        instanceId: sourceFile,
        sessionId,
        agentName: 'Cursor',
        userId: process.env.USER || 'anonymous',
      },
      project: {
        projectId: data.project_id || '',
        repoPath: data.repo_path || '',
        cwd,
        platform: process.platform,
      },
      type: eventType,
      toolName,
      toolInput,
      toolOutput,
      filesInvolved,
      context: {
        projectId: data.project_id || '',
        repoPath: data.repo_path || '',
        cwd,
        platform: process.platform,
      },
      extracted: {
        decisions: extractedDecisions,
        errors: data.errors || [],
        topics: data.topics || [],
      },
      raw: data,
    };

    return event;
  }
}
