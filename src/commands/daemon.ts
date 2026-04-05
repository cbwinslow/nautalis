import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import http from 'node:http';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { MemoryEngine } from '../memory/engine.js';
import { initTelemetry } from '../telemetry/provider.js';
import { formatDistanceToNow } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

let server: http.Server | null = null;

export function registerDaemonCommand(program: Command): void {
  const daemonCmd = program
    .command('daemon')
    .description('Manage the nautalis background daemon');

  daemonCmd
    .command('start')
    .description('Start the background HTTP daemon')
    .option('--port <port>', 'Port to listen on', '3001')
    .action(async (opts) => {
      const spinner = ora('Starting daemon...').start();

      try {
        initTelemetry();
        const config = await loadConfig();

        const store = await getStore(config);
        await store.init();

        const memoryEngine = new MemoryEngine(store, config);

        const port = parseInt(opts.port);

        server = http.createServer(async (req, res) => {
          try {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            // POST /api/events
            if (url.pathname === '/api/events' && req.method === 'POST') {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
              }
              const rawEvents = JSON.parse(body);
              const arr = Array.isArray(rawEvents) ? rawEvents : [rawEvents];

              // Convert hook payload to NautalisEvent
              const nautalisEvents = arr.map((h: any) => {
                // Map hook event_type to Nautalis EventType
                let type: string;
                switch (h.event_type) {
                  case 'PostToolUse':
                    type = 'tool_use';
                    break;
                  case 'Stop':
                    type = 'session_end';
                    break;
                  case 'SessionStart':
                    type = 'session_start';
                    break;
                  case 'SessionEnd':
                    type = 'session_end';
                    break;
                  default:
                    type = 'conversation';
                }

                const userId = config.general.userId;
                const teamId = config.general.teamId;

                // Build context and project (same for now)
                const context = {
                  teamId,
                  projectId: '',
                  repoPath: h.cwd || process.cwd(),
                  repoUrl: '',
                  branch: '',
                  cwd: h.cwd || process.cwd(),
                  platform: process.platform,
                };

                const nautalisEvent: any = {
                  eventId: uuidv4(),
                  timestamp: h.timestamp ? new Date(h.timestamp) : new Date(),
                  source: {
                    toolName: 'claude_code',
                    toolVersion: '',
                    instanceId: '',
                    sessionId: h.session_id || '',
                    agentName: 'Claude Code',
                    userId,
                  },
                  project: context,
                  type,
                  toolName: h.tool_name || undefined,
                  toolInput: h.tool_input || undefined,
                  toolOutput: h.tool_output || undefined,
                  filesInvolved: h.files_involved || [],
                  context,
                  extracted: { decisions: [], errors: [], topics: [] },
                  raw: h,
                };

                // Debug: log timestamp type
                if (process.env.DEBUG_DAEMON) {
                  console.log('Converted event timestamp:', typeof nautalisEvent.timestamp, nautalisEvent.timestamp);
                }

                return nautalisEvent;
              });

              // Debug: log first event
              if (process.env.DEBUG_DAEMON && nautalisEvents.length > 0) {
                console.log('Sample event:', JSON.stringify(nautalisEvents[0], (k, v) => k === 'timestamp' ? v.toString() : v, 2));
              }

              // Validate events before ingestion to catch errors early
              try {
                const { NautalisEventSchema } = await import('../validation/schemas.js');
                for (const ev of nautalisEvents) {
                  NautalisEventSchema.parse(ev);
                }
                if (process.env.DEBUG_DAEMON) {
                  console.log('Pre-ingest validation passed');
                }
              } catch (validationError) {
                console.error('Pre-ingest validation failed:', validationError);
                throw validationError; // will be caught below and return 500
              }

              const count = await memoryEngine.ingestEvents(nautalisEvents);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ingested: count }));
              return;
            }

            // GET /api/health
            if (url.pathname === '/api/health' && req.method === 'GET') {
              const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(health));
              return;
            }

            // POST /api/context/inject
            if (url.pathname === '/api/context/inject' && req.method === 'POST') {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
              }
              const { session_id, cwd } = body ? JSON.parse(body) : {};

               if (!config.general.teamId) {
                 res.writeHead(400, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ error: 'Team ID required' }));
                 return;
               }

               const limit = 10;
               let context: string;

               // Use semantic injection if configured, otherwise fallback to recency
               if (config.rag?.useSemanticInject) {
                 // Perform a RAG query with a general query to get relevant memories
                 const queryResult = await memoryEngine.query('important team activity', {
                   limit,
                 });
                 const memories = queryResult.map(r => r.memory);

                 const contextLines: string[] = [];
                 contextLines.push('=== Semantically Relevant Activity ===\n');

                 for (const memory of memories) {
                   const timeAgo = formatDistanceToNow(memory.createdAt, { addSuffix: true });
                   const agent = memory.agentIdentity.agentName || memory.agentIdentity.toolName;
                   const type = memory.classification.memoryType;
                   const summary = memory.content.summary;
                   contextLines.push(`[${timeAgo}] ${agent} (${type}): ${summary}`);

                   if (memory.content.detail && memory.content.detail.length > 0) {
                     const detailPreview =
                       memory.content.detail.length > 200
                         ? memory.content.detail.substring(0, 200) + '...'
                         : memory.content.detail;
                     contextLines.push(`  Details: ${detailPreview}\n`);
                   } else {
                     contextLines.push('');
                   }
                 }

                 contextLines.push('=== End of Context ===');
                 context = contextLines.join('\n');
               } else {
                 // Original recency-based approach
                 const memories = await store.listMemories(config.general.teamId, {
                   limit,
                   userId: config.general.userId,
                 });

                 const contextLines: string[] = [];
                 contextLines.push('=== Recent Team Activity ===\n');

                 for (const memory of memories) {
                   const timeAgo = formatDistanceToNow(memory.createdAt, { addSuffix: true });
                   const agent = memory.agentIdentity.agentName || memory.agentIdentity.toolName;
                   const type = memory.classification.memoryType;
                   const summary = memory.content.summary;
                   contextLines.push(`[${timeAgo}] ${agent} (${type}): ${summary}`);

                   if (memory.content.detail && memory.content.detail.length > 0) {
                     const detailPreview =
                       memory.content.detail.length > 200
                         ? memory.content.detail.substring(0, 200) + '...'
                         : memory.content.detail;
                     contextLines.push(`  Details: ${detailPreview}\n`);
                   } else {
                     contextLines.push('');
                   }
                 }

                 contextLines.push('=== End of Context ===');
                 context = contextLines.join('\n');
               }

               res.writeHead(200, { 'Content-Type': 'application/json' });
               res.end(JSON.stringify({ formatted_context: context }));
               return;
            }

            // POST /api/sessions/summarize
            if (url.pathname === '/api/sessions/summarize' && req.method === 'POST') {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
              }
              const { session_id } = body ? JSON.parse(body) : {};

              // TODO: Implement actual session summarization
              console.log(chalk.gray(`[summarize] Session ID: ${session_id || 'none'} (not yet implemented)`));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok' }));
              return;
            }

            // POST /api/sessions/finalize
            if (url.pathname === '/api/sessions/finalize' && req.method === 'POST') {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
              }
              const { session_id } = body ? JSON.parse(body) : {};

              // TODO: Implement session finalization
              console.log(chalk.gray(`[finalize] Session ID: ${session_id || 'none'} (not yet implemented)`));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok' }));
              return;
            }

            res.writeHead(404);
            res.end('Not Found');
            } catch (error) {
              console.error('Request handler error:', error);
              res.writeHead(500);
              res.end(`Error: ${error}`);
            }
        });

        server.listen(port, '0.0.0.0', () => {
          spinner.succeed(
            chalk.green(`Daemon started on http://0.0.0.0:${port}/`),
          );
          console.log(chalk.cyan('  Endpoints:'));
          console.log('    POST /api/events — ingest events');
          console.log('    GET  /api/health — health check');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
          await stopDaemon();
          process.exit(0);
        });
        process.on('SIGTERM', async () => {
          await stopDaemon();
          process.exit(0);
        });
      } catch (error) {
        spinner.fail(chalk.red(`Daemon start failed: ${error}`));
        process.exit(1);
      }
    });

  daemonCmd
    .command('stop')
    .description('Stop the background daemon')
    .action(async () => {
      await stopDaemon();
    });

  daemonCmd
    .command('status')
    .description('Check daemon status')
    .action(async () => {
      if (server) {
        console.log(chalk.green('Daemon is running'));
      } else {
        console.log(chalk.yellow('Daemon is not running'));
      }
    });
}

async function stopDaemon(): Promise<void> {
  if (server) {
    await new Promise((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve(undefined)));
    });
    server = null;
    console.log(chalk.green('Daemon stopped'));
  } else {
    console.log(chalk.yellow('Daemon was not running'));
  }
}
