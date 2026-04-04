/**
 * Shared test fixtures - immutable data used across multiple tests
 */

export const TEST_DB_CONFIG = {
  postgresql: 'postgresql://test:test@localhost:5433/nautalis_test',
  sqlite: ':memory:',
};

export const TEST_USER_1 = {
  id: 'user_test_001',
  email: 'test1@example.com',
  name: 'Test User 1',
};

export const TEST_USER_2 = {
  id: 'user_test_002',
  email: 'test2@example.com',
  name: 'Test User 2',
};

export const TEST_TEAM_1 = {
  id: 'team_test_001',
  name: 'Test Team Alpha',
  slug: 'test-alpha',
  ownerId: TEST_USER_1.id,
};

export const TEST_TEAM_2 = {
  id: 'team_test_002',
  name: 'Test Team Beta',
  slug: 'test-beta',
  ownerId: TEST_USER_2.id,
};

export const TEST_AGENT_CLAUDE = {
  id: 'agent_claude_001',
  type: 'claude-code',
  name: 'Claude Code Test',
  version: '0.2.0',
};

export const TEST_AGENT_KILO = {
  id: 'agent_kilo_001',
  type: 'kilo-code',
  name: 'Kilo Code Test',
  version: '0.1.0',
};

export const TEST_PROJECT_1 = {
  id: 'proj_test_001',
  name: 'test-project',
  teamId: TEST_TEAM_1.id,
};

export const SAMPLE_EMBEDDING = new Array(384).fill(0).map(() => Math.random());

export const SAMPLE_TEXT = `
  This is a sample text for testing embedding generation.
  It contains enough words to produce a meaningful vector.
  The content should be realistic and cover various topics.
  Memory systems need good quality embeddings to work effectively.
`;
