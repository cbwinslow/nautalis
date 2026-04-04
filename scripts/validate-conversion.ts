#!/usr/bin/env bun
// Test conversion from hook payload to NautalisEvent

import { NautalisEventSchema } from '../src/validation/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// Sample hook payload (simulating what record-event.js sends)
const hookEvent = {
  event_type: 'PostToolUse',
  tool_name: 'echo',
  tool_input: { command: 'echo', message: 'Hello' },
  tool_output: { stdout: 'Hello\n', exitCode: 0 },
  session_id: 'test-session-123',
  cwd: '/tmp',
  timestamp: '2025-04-04T20:35:00Z',
};

// Simulate conversion (same logic as daemon)
const config = {
  general: {
    userId: '37d60786-b6f0-404f-9b9b-55ef819de42e',
    teamId: 'ab185128-6326-41ba-a697-5ff38d102150',
  },
};

let type: string;
switch (hookEvent.event_type) {
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

const context = {
  teamId,
  projectId: '',
  repoPath: hookEvent.cwd || process.cwd(),
  repoUrl: '',
  branch: '',
  cwd: hookEvent.cwd || process.cwd(),
  platform: process.platform,
};

const nautalisEvent = {
  eventId: uuidv4(),
  timestamp: hookEvent.timestamp ? new Date(hookEvent.timestamp) : new Date(),
  source: {
    toolName: 'claude_code',
    toolVersion: '',
    instanceId: '',
    sessionId: hookEvent.session_id || '',
    agentName: 'Claude Code',
    userId,
  },
  project: context,
  type,
  toolName: hookEvent.tool_name || undefined,
  toolInput: hookEvent.tool_input || undefined,
  toolOutput: hookEvent.tool_output || undefined,
  filesInvolved: hookEvent.files_involved || [],
  context,
  extracted: { decisions: [], errors: [], topics: [] },
  raw: hookEvent,
};

console.log('Converted event:');
console.log(JSON.stringify(nautalisEvent, (key, value) => key === 'timestamp' ? value.toString() : value, 2));

console.log('\nValidating with schema...');
try {
  NautalisEventSchema.parse(nautalisEvent);
  console.log('✅ Event is valid!');
} catch (err) {
  console.error('❌ Validation failed:', err);
  process.exit(1);
}
