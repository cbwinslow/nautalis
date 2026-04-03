#!/usr/bin/env node
// Claude Code PostToolUse hook — records events to nautalis
// Receives hook JSON on stdin, sends to nautalis daemon

const { stdin, stdout, stderr } = process;

async function main() {
  let data = '';
  stdin.setEncoding('utf8');
  
  for await (const chunk of stdin) {
    data += chunk;
  }
  
  try {
    const event = JSON.parse(data);
    
    // Send to nautalis daemon
    const response = await fetch('http://localhost:3001/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'claude_code',
        event_type: event.hook_event_name,
        tool_name: event.tool_name,
        tool_input: event.tool_input,
        tool_output: event.tool_output,
        session_id: event.session_id,
        cwd: event.cwd,
        transcript_path: event.transcript_path,
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      stderr.write(`Failed to send event: ${response.status}\n`);
    }
  } catch (error) {
    stderr.write(`Error processing event: ${error.message}\n`);
  }
  
  // Always exit 0 — don't block Claude Code
  process.exit(0);
}

main();
