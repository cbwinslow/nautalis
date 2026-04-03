import { Command } from 'commander';
import { registerInitCommand } from './init.js';
import { registerDaemonCommand } from './daemon.js';
import { registerIngestCommand } from './ingest.js';
import { registerSearchCommand } from './search.js';
import { registerAskCommand } from './ask.js';
import { registerTimelineCommand } from './timeline.js';
import { registerHooksCommand } from './hooks.js';
import { registerMemoryCommand } from './memory.js';
import { registerInjectCommand } from './inject.js';
import { registerStatusCommand } from './status.js';
import { registerConnectorsCommand } from './connectors.js';
import { registerSetupCommand } from './setup.js';

export function registerCommands(program: Command): void {
  registerInitCommand(program);
  registerDaemonCommand(program);
  registerIngestCommand(program);
  registerSearchCommand(program);
  registerAskCommand(program);
  registerTimelineCommand(program);
  registerHooksCommand(program);
  registerMemoryCommand(program);
  registerInjectCommand(program);
  registerStatusCommand(program);
  registerConnectorsCommand(program);
  registerSetupCommand(program);
}
