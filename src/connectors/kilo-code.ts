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

export class KiloCodeConnector extends BaseConnector {
  metadata: ConnectorMetadata = {
    name: 'kilo_code',
    description: 'Kilo Code — AI coding assistant',
    version: '1.0.0',
    supportedFeatures: ['transcripts', 'sessions'],
    requiredTools: ['kilocode'],
  };
  
  private eventsIngested = 0;
  private lastIngest: Date | null = null;
  
  async ingest(config: ConnectorConfig): Promise<NautalisEvent[]> {
    const events: NautalisEvent[] = [];
    
    for (const sourceDir of config.sourceDirs) {
      const expandedDir = sourceDir.replace(/^~/, os.homedir());
      
      if (!fsSync.existsSync(expandedDir)) {
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
     logMessage('info', 'Context injection not supported for Kilo Code');
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
    logMessage('warn', `Kilo Code session parsing not fully implemented: ${filePath}`);
    return [];
  }
}
