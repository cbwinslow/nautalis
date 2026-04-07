import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { ClaudeCodeConnector } from '../connectors/claude-code.js';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerHooksCommand(program: Command): void {
  const hooksCmd = program
    .command('hooks')
    .description('Manage AI agent hooks and integrations');
  
  hooksCmd
    .command('install')
    .description('Install hooks for an AI agent')
    .argument('[agent]', 'Agent to install hooks for (claude, kilo, all)')
    .action(async (agent) => {
      initTelemetry();
      const spinner = ora(`Installing hooks for ${agent || 'all agents'}...`).start();
      
      try {
        await withSpan('nautalis.command.hooks.install', { agent: agent || 'all' }, async () => {
           await loadConfig();
          
          if (agent === 'claude' || agent === 'all' || !agent) {
            const connector = new ClaudeCodeConnector();
            await connector.setup({ enabled: true, sourceDirs: [] });
            console.log(chalk.green('  ✓ Claude Code hooks installed'));
          }
          
          spinner.succeed(chalk.green('Hooks installed successfully'));
        });
      } catch (error) {
        spinner.fail(chalk.red(`Hook installation failed: ${error}`));
        throw error;
      }
    });
  
  hooksCmd
    .command('list')
    .description('List installed hooks')
    .action(async () => {
      initTelemetry();
      await withSpan('nautalis.command.hooks.list', {}, async () => {
        console.log(chalk.cyan('\n  Installed Hooks:\n'));
        console.log(chalk.gray('  Claude Code:'));
        console.log(chalk.white('    • PostToolUse → nautalis ingest claude-event'));
        console.log(chalk.white('    • Stop → nautalis summarize-session'));
        console.log(chalk.white('    • SessionEnd → nautalis finalize-session'));
        console.log(chalk.white('    • SessionStart → nautalis inject-context'));
        console.log('');
      });
    });
}
