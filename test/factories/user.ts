import type { User } from '@/types/team.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Factory for creating test users
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: `user_${uuidv4()}`,
    email: `test_${Date.now()}@example.com`,
    name: 'Test User',
    avatarUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    isActive: true,
    ...overrides,
  };
}

/**
 * Create admin user
 */
export function createAdminUser(overrides: Partial<User> = {}): User {
  return createTestUser({
    email: `admin_${Date.now()}@example.com`,
    name: 'Admin User',
    ...overrides,
  });
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number, overrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({
      email: `user${i}_${Date.now()}@example.com`,
      name: `User ${i}`,
      ...overrides,
    }),
  );
}
