import type { NautalisConfig } from '../types/config.js';
import * as os from 'os';
import * as path from 'path';

const defaultDbPath = path.join(os.homedir(), '.local', 'share', 'nautalis', 'nautalis.db');

export const defaultConfig: NautalisConfig = {
  general: {
    userId: process.env.USER || os.userInfo().username || 'anonymous',
    teamId: undefined,
  },
  database: {
    driver: 'sqlite',
    sqlite: { path: defaultDbPath },
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
    { type: 'claude_code', enabled: true, sourceDirs: [path.join(os.homedir(), '.claude', 'projects')] },
    { type: 'kilo_code', enabled: true, sourceDirs: [path.join(os.homedir(), '.kilocode', 'sessions')] },
  ],
  guardrails: {
    piiDetection: true,
    secretDetection: true,
    maxContextLines: 100,
    minRelevanceScore: 0.7,
  },
  rules: [],
};
