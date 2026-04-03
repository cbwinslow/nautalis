#!/usr/bin/env node
// Claude Code Stop hook — requests session summarization

async function main() {
  try {
    await fetch('http://localhost:3001/api/sessions/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Silently fail — don't block Claude Code
  }
  
  process.exit(0);
}

main();
