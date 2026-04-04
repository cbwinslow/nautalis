import type { Team } from '@/types/team.js';
import { v4 as uuidv4 } from 'uuid';
import { createTestUser } from './user.js';

/**
 * Factory for creating test teams
 */
export function createTestTeam(
  overrides: Partial<Team> = {},
  withOwner: boolean = true,
): Team & { ownerId?: string } {
  const teamId = `team_${uuidv4()}`;
  const ownerId = withOwner ? `owner_${uuidv4()}` : undefined;

  return {
    id: teamId,
    name: 'Test Team',
    slug: `test-team-${Date.now()}`,
    description: 'A test team for automated testing',
    settings: {
      maxMembers: 50,
      allowSelfInvite: false,
      requireApproval: true,
      defaultRole: 'member',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: ownerId || 'system',
    ownerId,
    ...overrides,
  };
}

/**
 * Create team with default members
 */
export function createTeamWithMembers(
  memberCount: number = 3,
  overrides: Partial<Team> = {},
): Team[] {
  const teams: Team[] = [];

  for (let i = 0; i < memberCount; i++) {
    teams.push(
      createTestTeam({
        name: `Team ${i + 1}`,
        slug: `team-${i + 1}`,
      }),
    );
  }

  return teams;
}

/**
 * Create enterprise team with custom settings
 */
export function createEnterpriseTeam(overrides: Partial<Team> = {}): Team {
  return createTestTeam({
    name: 'Enterprise Corp',
    slug: 'enterprise-corp',
    description: 'Enterprise-level test team',
    settings: {
      maxMembers: 1000,
      allowSelfInvite: false,
      requireApproval: true,
      defaultRole: 'member',
      enableAuditLog: true,
      enableTelemetry: true,
    },
    ...overrides,
  });
}
