#!/usr/bin/env bun
/**
 * Connector Validation Script
 * 
 * Tests that connectors can parse their fixture data and produce valid NautalisEvent objects.
 * Usage: bun run scripts/validate-connectors.ts [connectorName]
 */

import { ClaudeCodeConnector } from '../src/connectors/claude-code.js';
import { KiloCodeConnector } from '../src/connectors/kilo-code.js';
import { FileSystemConnector } from '../src/connectors/filesystem.js';
import { join } from 'path';

const connectorName = process.argv[2] || 'claude';

async function validate() {
  console.log(`\n🐙 Validating connector: ${connectorName}\n`);

  let connector;
  let fixturePath: string;

  if (connectorName === 'claude') {
    connector = new ClaudeCodeConnector();
    fixturePath = join(process.cwd(), 'test', 'fixtures', 'claude-transcript.jsonl');
  } else if (connectorName === 'kilo') {
    connector = new KiloCodeConnector();
    fixturePath = join(process.cwd(), 'test', 'fixtures', 'kilo-session.jsonl'); // placeholder
  } else if (connectorName === 'filesystem') {
    connector = new FileSystemConnector();
    // FileSystem watch does not have a direct parse method; skip for now
    console.log('✅ FileSystem connector does not have a parse test yet');
    process.exit(0);
  } else {
    console.error(`Unknown connector: ${connectorName}. Use 'claude', 'kilo', or 'filesystem'.`);
    process.exit(1);
  }

  try {
    // Directly call the private parseTranscript method for validation
    const events = await (connector as any).parseTranscript(fixturePath);
    console.log(`✅ Parsed ${events.length} events from ${fixturePath}`);

    // Validate each event has required fields
    let errors = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.eventId) {
        console.error(`  ❌ Event ${i}: Missing eventId`);
        errors++;
      }
      if (!event.timestamp) {
        console.error(`  ❌ Event ${i}: Missing timestamp`);
        errors++;
      }
      if (!event.source?.toolName) {
        console.error(`  ❌ Event ${i}: Missing source.toolName`);
        errors++;
      }
      if (!event.type) {
        console.error(`  ❌ Event ${i}: Missing type`);
        errors++;
      }
    }

    if (errors > 0) {
      console.error(`\n❌ Validation failed with ${errors} errors\n`);
      process.exit(1);
    } else {
      console.log('\n✅ All events are valid\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Parsing failed:', error);
    process.exit(1);
  }
}

validate();
