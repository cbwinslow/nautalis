import { BaseConnector } from './base.js';
import type { ConnectorConfig, ConnectorHealth, ConnectorMetadata } from '../types/connector.js';
import type { NautalisEvent } from '../types/event.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as fsSync from 'fs';
import { logMessage } from '../telemetry/api.js';

export class FileSystemConnector extends BaseConnector {
  metadata: ConnectorMetadata = {
    name: 'filesystem',
    description: 'Generic filesystem connector for custom AI agents',
    version: '1.0.0',
    supportedFeatures: ['file_monitoring', 'custom_parsing'],
    requiredTools: [],
  };

  private eventsIngested = 0;
  private lastIngest: Date | null = null;
  private watchedFiles = new Map<string, number>(); // filePath -> mtime
  private abortController: AbortController | null = null;
  
   async ingest(config: ConnectorConfig): Promise<NautalisEvent[]> {
     const events: NautalisEvent[] = [];
     
     for (const sourceDir of config.sourceDirs) {
       const expandedDir = sourceDir.replace(/^~/, os.homedir());
       
       if (!fsSync.existsSync(expandedDir)) {
         logMessage('warn', `Source directory not found: ${expandedDir}`);
         continue;
       }
       
       const files = await this.findFiles(expandedDir, config.filePattern || '*');
       
       for (const file of files) {
         // Skip if file hasn't changed since last ingest
         try {
           const stat = await fs.stat(file);
           const lastMtime = this.watchedFiles.get(file);
           if (lastMtime && stat.mtimeMs <= lastMtime) {
             continue; // unchanged
           }
           this.watchedFiles.set(file, stat.mtimeMs);
         } catch {
           // If we can't stat, still try to process (maybe new file)
         }

         const content = await fs.readFile(file, 'utf-8');
         
         if (config.parser === 'jsonl') {
           const lines = content.trim().split('\n').filter(Boolean);
           for (const line of lines) {
             try {
               const data = JSON.parse(line);
               events.push(this.createEvent(data, file));
             } catch {
               // Skip malformed lines
             }
           }
         } else if (config.parser === 'json') {
           try {
             const data = JSON.parse(content);
             events.push(this.createEvent(data, file));
           } catch {
             // Skip malformed files
           }
         } else if (config.parser === 'custom' && config.customParserCmd) {
           logMessage('warn', 'Custom parser not yet implemented');
         }
       }
     }
     
     this.eventsIngested += events.length;
     this.lastIngest = new Date();
     
     return events;
   }
  
   async *watch(config: ConnectorConfig): AsyncGenerator<NautalisEvent> {
     logMessage('info', 'FileSystemConnector watch started');
     const pollInterval = config.pollIntervalMs || 5000;
     this.abortController = new AbortController();

     while (true) {
       try {
         const events = await this.ingest(config);
         for (const event of events) {
           yield event;
         }
       } catch (error) {
         logMessage('error', `Watch ingest error: ${error}`);
       }

       // Wait for interval or abort
       await new Promise(resolve => {
         const timeout = setTimeout(resolve, pollInterval);
         this.abortController?.signal.addEventListener('abort', () => {
           clearTimeout(timeout);
           resolve(undefined);
         }, { once: true });
       });

       if (this.abortController?.signal.aborted) {
         break;
       }
     }

     logMessage('info', 'FileSystemConnector watch stopped');
   }
  
  private async findFiles(dir: string, pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          if (pattern === '*' || entry.name.endsWith(pattern.replace(/^\*/, ''))) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await walk(dir);
    return files;
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

   private createEvent(data: Record<string, unknown>, sourceFile: string): NautalisEvent {
    return {
      eventId: uuidv4(),
      timestamp: new Date((data.timestamp as string) || Date.now()),
      source: {
        toolName: 'filesystem',
        toolVersion: '1.0.0',
        instanceId: sourceFile,
        sessionId: (data.session_id as string) || '',
        agentName: (data.agent_name as string) || 'Unknown',
        userId: process.env.USER || 'anonymous',
      },
      project: {
        projectId: (data.project_id as string) || '',
        repoPath: (data.repo_path as string) || '',
        cwd: process.cwd(),
        platform: process.platform,
      },
      type: (data.type as any) || 'conversation',
      toolName: data.tool_name as string,
      toolInput: data.tool_input as any,
      toolOutput: data.tool_output as any,
      filesInvolved: (data.files_involved as string[]) || [],
      context: {
        projectId: (data.project_id as string) || '',
        repoPath: (data.repo_path as string) || '',
        cwd: process.cwd(),
        platform: process.platform,
      },
      extracted: {
        decisions: (data.decisions as string[]) || [],
        errors: (data.errors as string[]) || [],
        topics: (data.topics as string[]) || [],
      },
      raw: data,
    };
  }
}
