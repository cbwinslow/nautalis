import { BaseConnector } from './base.js';
import type { ConnectorConfig, ConnectorHealth, ConnectorMetadata } from '../types/connector.js';
import type { NautalisEvent } from '../types/event.js';
import type { AgentContext } from '../types/context.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fsSync from 'fs';
import { logMessage } from '../telemetry/api.js';

export class ClaudeCodeConnector extends BaseConnector {
  metadata: ConnectorMetadata = {
    name: 'claude_code',
    description: 'Claude Code — Anthropic\'s coding agent with rich hooks',
    version: '1.0.0',
    supportedFeatures: ['hooks', 'transcripts', 'context_injection'],
    requiredTools: ['claude'],
  };
  
  private eventsIngested = 0;
  private lastIngest: Date | null = null;
  
  async setup(_config: ConnectorConfig): Promise<void> {
    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    
    const hooks = {
      PostToolUse: [
        {
          matcher: '*',
          hooks: [{
            type: 'command',
            command: 'nautalis ingest claude-event --async',
            async: true,
            timeout: 30,
          }],
        },
      ],
      Stop: [
        {
          hooks: [{
            type: 'command',
            command: 'nautalis summarize-session',
            async: true,
            timeout: 60,
          }],
        },
      ],
      SessionEnd: [
        {
          hooks: [{
            type: 'command',
            command: 'nautalis finalize-session',
          }],
        },
      ],
      SessionStart: [
        {
          hooks: [{
            type: 'command',
            command: 'nautalis inject-context',
          }],
        },
      ],
    };
    
    try {
      let existingSettings: any = {};
      if (fsSync.existsSync(claudeSettingsPath)) {
        const content = await fs.readFile(claudeSettingsPath, 'utf-8');
        existingSettings = JSON.parse(content);
      }
      
      existingSettings.hooks = { ...existingSettings.hooks, ...hooks };
      
      await fs.writeFile(claudeSettingsPath, JSON.stringify(existingSettings, null, 2), 'utf-8');
      logMessage('info', 'Installed Claude Code hooks');
    } catch (error) {
      logMessage('warn', `Could not install Claude Code hooks: ${error}`);
    }
  }
  
  async ingest(config: ConnectorConfig): Promise<NautalisEvent[]> {
    const events: NautalisEvent[] = [];
    
    for (const sourceDir of config.sourceDirs) {
      const expandedDir = sourceDir.replace(/^~/, os.homedir());
      
      if (!fsSync.existsSync(expandedDir)) {
        continue;
      }
      
      const transcripts = await this.findTranscripts(expandedDir);
      
      for (const transcriptPath of transcripts) {
        const transcriptEvents = await this.parseTranscript(transcriptPath);
        events.push(...transcriptEvents);
      }
    }
    
    this.eventsIngested += events.length;
    this.lastIngest = new Date();
    
    return events;
  }
  
  async inject(context: AgentContext): Promise<void> {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context.formattedContext,
      },
    };
    
    process.stdout.write(JSON.stringify(output) + '\n');
  }
  
  async health(): Promise<ConnectorHealth> {
    const claudePath = path.join(os.homedir(), '.claude');
    const exists = fsSync.existsSync(claudePath);
    
    return {
      status: exists ? 'healthy' : 'degraded',
      lastCheck: new Date(),
      lastIngest: this.lastIngest,
      eventsIngested: this.eventsIngested,
      errors: exists ? [] : ['Claude Code directory not found'],
    };
  }
  
  private async findTranscripts(dir: string): Promise<string[]> {
    const transcripts: string[] = [];
    
    async function walk(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name === 'transcript.jsonl') {
          transcripts.push(fullPath);
        }
      }
    }
    
    await walk(dir);
    return transcripts;
  }
  
  private async parseTranscript(filePath: string): Promise<NautalisEvent[]> {
    const events: NautalisEvent[] = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        if (data.type === 'assistant' && data.message?.content) {
          const content = data.message.content;
          
          if (typeof content === 'string') {
            events.push({
              eventId: uuidv4(),
              timestamp: new Date(data.timestamp || Date.now()),
              source: {
                toolName: 'claude_code',
                toolVersion: '',
                instanceId: '',
                sessionId: data.session_id || '',
                agentName: 'Claude Code',
                userId: process.env.USER || 'anonymous',
              },
              project: {
                projectId: '',
                repoPath: '',
                cwd: process.cwd(),
                platform: process.platform,
              },
              type: 'conversation',
              filesInvolved: [],
              context: {
                projectId: '',
                repoPath: '',
                cwd: process.cwd(),
                platform: process.platform,
              },
              extracted: { decisions: [], errors: [], topics: [] },
              raw: data,
            });
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use') {
                events.push({
                  eventId: uuidv4(),
                  timestamp: new Date(data.timestamp || Date.now()),
                  source: {
                    toolName: 'claude_code',
                    toolVersion: '',
                    instanceId: '',
                    sessionId: data.session_id || '',
                    agentName: 'Claude Code',
                    userId: process.env.USER || 'anonymous',
                  },
                  project: {
                    projectId: '',
                    repoPath: '',
                    cwd: process.cwd(),
                    platform: process.platform,
                  },
                  type: 'tool_use',
                  toolName: block.name,
                  toolInput: block.input,
                  filesInvolved: block.input?.file_path ? [block.input.file_path] : [],
                  context: {
                    projectId: '',
                    repoPath: '',
                    cwd: process.cwd(),
                    platform: process.platform,
                  },
                  extracted: { decisions: [], errors: [], topics: [] },
                  raw: data,
                });
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
    
    return events;
  }
}
