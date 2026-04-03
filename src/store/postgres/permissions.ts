import pg from 'pg';
import { logMessage } from '../../telemetry/api.js';

export class PermissionManager {
  private pool: pg.Pool;
  private roleCache = new Map<string, { role: string; expiresAt: number }>();
  private readonly CACHE_TTL = 60000;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async check(userId: string, teamId: string, scope: string, action: string): Promise<boolean> {
    const cacheKey = `${teamId}:${userId}`;

    const cached = this.roleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const role = cached.role;
      return this.checkRolePermission(role, scope, action);
    }

    const result = await this.pool.query(
      `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND is_active = true`,
      [teamId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const role = result.rows[0].role;
    this.roleCache.set(cacheKey, { role, expiresAt: Date.now() + this.CACHE_TTL });

    return this.checkRolePermission(role, scope, action);
  }

  private async checkRolePermission(role: string, scope: string, action: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT granted FROM role_permissions WHERE role = $1 AND scope = $2 AND action = $3`,
      [role, scope, action]
    );

    return result.rows[0]?.granted ?? false;
  }

  async grant(teamId: string, userId: string, scope: string, action: string, granted: boolean) {
    await this.pool.query(
      `INSERT INTO team_permissions (team_id, user_id, scope, action, granted)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, user_id, scope, action) DO UPDATE SET granted = $5, updated_at = NOW()`,
      [teamId, userId, scope, action, granted]
    );

    this.roleCache.delete(`${teamId}:${userId}`);
  }

  clearCache() {
    this.roleCache.clear();
  }
}
