import { Command } from 'commander';
import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerSystemCommand(program: Command): void {
  const systemCmd = program
    .command('system')
    .description('System administration utilities');

  systemCmd
    .command('create-user')
    .description('Create a dedicated nautalis system user (requires root)')
    .action(async () => {
      initTelemetry();
      await withSpan('nautalis.command.system.create-user', {}, async () => {
        const scriptPath = join(__dirname, '..', '..', 'scripts', 'create-nautalis-user.sh');
        
        try {
          // Check if running as root
          if (process.getuid && process.getuid() !== 0) {
            console.error(chalk.red('ERROR: This command must be run as root or with sudo'));
            process.exit(1);
          }

          // Execute the shell script
          execSync(`bash "${scriptPath}"`, { stdio: 'inherit' });
        } catch (error: any) {
          console.error(chalk.red(`Failed to create system user: ${error.message}`));
          process.exit(1);
        }
      });
    });
}
