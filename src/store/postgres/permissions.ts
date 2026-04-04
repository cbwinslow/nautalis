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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch old permission for audit
      const oldResult = await client.query(
        `SELECT * FROM team_permissions WHERE team_id = $1 AND user_id = $2 AND scope = $3 AND action = $4`,
        [teamId, userId, scope, action]
      );
      const oldPermission = oldResult.rows[0] || null;

      // Upsert permission
      const result = await client.query(
        `INSERT INTO team_permissions (team_id, user_id, scope, action, granted)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (team_id, user_id, scope, action) DO UPDATE SET granted = $5, updated_at = NOW()
         RETURNING *`,
        [teamId, userId, scope, action, granted]
      );
      const newPermission = result.rows[0];

      // Insert audit log
      const auditAction = granted ? 'grant' : 'revoke';
      await client.query(
        `INSERT INTO audit_log (team_id, user_id, action, resource_type, resource_id, old_values, new_values, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          teamId,
          userId,
          auditAction,
          'permission',
          `permission:${teamId}:${userId}:${scope}:${action}`,
          oldPermission ? JSON.stringify(oldPermission) : null,
          JSON.stringify(newPermission),
        ]
      );

      await client.query('COMMIT');

      this.roleCache.delete(`${teamId}:${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  clearCache() {
    this.roleCache.clear();
  }
}
