#!/usr/bin/env node
// Claude Code SessionStart hook — injects context from nautalis

const NAUTALIS_URL = process.env.NAUTALIS_SERVER_URL || 'http://localhost:3001';

async function main() {
  try {
    const response = await fetch(`${NAUTALIS_URL}/api/context/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: process.env.CLAUDE_SESSION_ID || '',
        cwd: process.cwd(),
      }),
    });
    
    if (response.ok) {
      const context = await response.json();
      
      // Output context for Claude Code to consume
      const output = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: context.formatted_context || '',
        },
      };
      
      process.stdout.write(JSON.stringify(output) + '\n');
    }
  } catch {
    // Silently fail
  }
  
  process.exit(0);
}

main();
