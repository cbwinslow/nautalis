#!/usr/bin/env node
// Claude Code SessionStart hook — injects context from nautalis

async function main() {
  try {
    const response = await fetch('http://localhost:3001/api/context/inject', {
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
