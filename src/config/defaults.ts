import type { NautalisConfig } from '../types/config.js';
import * as os from 'os';

export const defaultConfig: NautalisConfig = {
  general: {
    userId: process.env.USER || os.userInfo().username || 'anonymous',
    teamId: undefined,
  },
  database: {
    driver: 'postgres',
    postgres: { url: process.env.DATABASE_URL || 'postgresql://nautalis:nautalis@localhost:5432/nautalis' },
  },
  embeddings: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    ollama: { url: 'http://localhost:11434' },
  },
  llm: {
    provider: 'ollama',
    model: 'qwen2.5:3b',
    ollama: { url: 'http://localhost:11434' },
  },
  connectors: [
    { type: 'claude_code', enabled: true, sourceDirs: [`${os.homedir()}/.claude/projects`] },
    { type: 'kilo_code', enabled: true, sourceDirs: [`${os.homedir()}/.kilocode/sessions`] },
  ],
  guardrails: {
    piiDetection: true,
    secretDetection: true,
    maxContextLines: 100,
    minRelevanceScore: 0.7,
  },
  rules: [],
  // Deployment mode: 'local' (baremetal), 'docker' (compose), 'baremetal' (alias for local)
  deployment: 'local',
};
