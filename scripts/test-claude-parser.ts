#!/usr/bin/env bun
/**
 * Test script to validate Claude Code connector transcript parsing.
 * Usage: bun run scripts/test-claude-parser.ts <path-to-transcript.jsonl>
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Replicate the parsing logic from ClaudeCodeConnector
function parseTranscript(content: string) {
  const events: any[] = [];
  const lines = content.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const data = JSON.parse(line);

      if (data.type === 'assistant' && data.message?.content) {
        const content = data.message.content;

        if (typeof content === 'string') {
          events.push({
            eventId: uuidv4(),
            timestamp: new Date(data.timestamp || Date.now()),
            source: {
              toolName: 'claude_code',
              toolVersion: '',
              instanceId: '',
              sessionId: data.session_id || '',
              agentName: 'Claude Code',
              userId: process.env.USER || 'anonymous',
            },
            project: {
              projectId: '',
              repoPath: '',
              cwd: process.cwd(),
              platform: process.platform,
            },
            type: 'conversation',
            filesInvolved: [],
            context: {
              projectId: '',
              repoPath: '',
              cwd: process.cwd(),
              platform: process.platform,
            },
            extracted: { decisions: [], errors: [], topics: [] },
            raw: data,
          });
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              events.push({
                eventId: uuidv4(),
                timestamp: new Date(data.timestamp || Date.now()),
                source: {
                  toolName: 'claude_code',
                  toolVersion: '',
                  instanceId: '',
                  sessionId: data.session_id || '',
                  agentName: 'Claude Code',
                  userId: process.env.USER || 'anonymous',
                },
                project: {
                  projectId: '',
                  repoPath: '',
                  cwd: process.cwd(),
                  platform: process.platform,
                },
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
                filesInvolved: block.input?.file_path ? [block.input.file_path] : [],
                context: {
                  projectId: '',
                  repoPath: '',
                  cwd: process.cwd(),
                  platform: process.platform,
                },
                extracted: { decisions: [], errors: [], topics: [] },
                raw: data,
              });
            }
          }
        }
      }
    } catch (err) {
      // Skip malformed lines
      console.warn('Failed to parse line:', err);
    }
  }

  return events;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: bun run scripts/test-claude-parser.ts <path-to-transcript.jsonl>');
    process.exit(1);
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const events = parseTranscript(content);

    console.log(`Parsed ${events.length} events from ${filePath}\n`);
    for (const event of events) {
      console.log(`- [${event.type}] ${event.toolName || 'conversation'}`);
      console.log(`  Timestamp: ${event.timestamp.toISOString()}`);
      console.log(`  Session ID: ${event.source.sessionId}`);
      console.log(`  Files: ${event.filesInvolved.join(', ') || 'none'}`);
      const inputStr = event.toolInput ? JSON.stringify(event.toolInput) : 'none';
      console.log(`  ToolInput: ${inputStr.substring(0, 100)}${inputStr.length > 100 ? '...' : ''}`);
      console.log('');
    }

    console.log('Validation: Check that event structure matches NautalisEvent schema.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
