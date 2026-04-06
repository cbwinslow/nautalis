import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../types/permissions.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerPermissionsCommand(program: Command): void {
  const permissionsCmd = program.command('permissions').description('Manage team permissions');

  permissionsCmd
    .command('check <userId> <scope> <action>')
    .description('Check if a user has a specific permission')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (userId: string, scope: string, action: string, options: { team?: string }) => {
      initTelemetry();
      try {
        await withSpan('nautalis.command.permissions.check', { userId, scope, action, team: options.team || '' }, async () => {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

          const hasPermission = await store.checkPermission(userId, teamId, scope, action);

          if (hasPermission) {
            console.log(chalk.green(`✓ User ${userId} has permission to ${action} ${scope}`));
          } else {
            console.log(chalk.red(`✗ User ${userId} does not have permission to ${action} ${scope}`));
          }
        });
      } catch (error) {
        console.log(chalk.red(`Failed to check permission: ${error}`));
        throw error;
      }
    });

  permissionsCmd
    .command('grant <userId> <scope> <action>')
    .description('Grant a permission to a user')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (userId: string, scope: string, action: string, options: { team?: string }) => {
      initTelemetry();
      const spinner = ora('Granting permission...').start();

      try {
        await withSpan('nautalis.command.permissions.grant', { userId, scope, action, team: options.team || '' }, async () => {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

          await store.grantPermission(teamId, userId, scope, action, true);

          spinner.succeed(chalk.green(`Granted ${action} permission on ${scope} to user ${userId}`));
        });
      } catch (error) {
        spinner.fail(chalk.red(`Failed to grant permission: ${error}`));
        throw error;
      }
    });

  permissionsCmd
    .command('revoke <userId> <scope> <action>')
    .description('Revoke a permission from a user')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (userId: string, scope: string, action: string, options: { team?: string }) => {
      initTelemetry();
      const spinner = ora('Revoking permission...').start();

      try {
        await withSpan('nautalis.command.permissions.revoke', { userId, scope, action, team: options.team || '' }, async () => {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

          await store.grantPermission(teamId, userId, scope, action, false);

          spinner.succeed(
            chalk.green(`Revoked ${action} permission on ${scope} from user ${userId}`),
          );
        });
      } catch (error) {
        spinner.fail(chalk.red(`Failed to revoke permission: ${error}`));
        throw error;
      }
    });

  permissionsCmd
    .command('matrix')
    .description('Display the permission matrix for all roles')
    .action(async () => {
      initTelemetry();
      await withSpan('nautalis.command.permissions.matrix', {}, async () => {
        console.log(chalk.cyan('\n  Permission Matrix by Role\n'));

        // Define scopes and actions for display
        const scopes = [
          'team',
          'project',
          'agent',
          'memory',
          'knowledge_base',
          'telemetry',
          'settings',
        ] as const;
        const actions = ['read', 'write', 'delete', 'admin', 'share', 'export', 'import'] as const;

        // Header
        console.log(chalk.bold('  Role'.padEnd(10)), '|', scopes.map((s) => s.padEnd(15)).join('|'));
        console.log(
          chalk.gray('  ' + '-'.repeat(10)),
          '+',
          scopes.map(() => '-'.repeat(15)).join('+'),
        );

        // Matrix rows
        for (const matrix of DEFAULT_ROLE_PERMISSIONS) {
          const roleDisplay = chalk.bold(matrix.role.padEnd(10));
          const permissions = scopes
            .map((scope) => {
              const roleActions = matrix.permissions[scope] || [];
              const actionStr = actions
                .map((action) => (roleActions.includes(action) ? action[0].toUpperCase() : '-'))
                .join('');
              return chalk.gray(actionStr.padEnd(15));
            })
            .join('|');

          console.log(`  ${roleDisplay} | ${permissions}`);
        }

        console.log('');

        // Legend
        console.log(
          chalk.gray('  Legend: R=read, W=write, D=delete, A=admin, S=share, E=export, I=import'),
        );
        console.log(chalk.gray('  Note: Custom permissions can override these defaults'));
      });
    });
}
