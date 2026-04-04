#!/usr/bin/env node
// Claude Code Stop hook — requests session summarization

const NAUTALIS_URL = process.env.NAUTALIS_SERVER_URL || 'http://localhost:3001';

async function main() {
  try {
    await fetch(`${NAUTALIS_URL}/api/sessions/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Silently fail — don't block Claude Code
  }
  
  process.exit(0);
}

main();
