import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { setupConnectors } from '../connectors/registry.js';
import { ClaudeCodeConnector } from '../connectors/claude-code.js';
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
      const spinner = ora(`Installing hooks for ${agent || 'all agents'}...`).start();
      
      try {
        const config = await loadConfig();
        
        if (agent === 'claude' || agent === 'all' || !agent) {
          const connector = new ClaudeCodeConnector();
          await connector.setup({ enabled: true, sourceDirs: [] });
          console.log(chalk.green('  ✓ Claude Code hooks installed'));
        }
        
        spinner.succeed(chalk.green('Hooks installed successfully'));
      } catch (error) {
        spinner.fail(chalk.red(`Hook installation failed: ${error}`));
        process.exit(1);
      }
    });
  
  hooksCmd
    .command('list')
    .description('List installed hooks')
    .action(async () => {
      console.log(chalk.cyan('\n  Installed Hooks:\n'));
      console.log(chalk.gray('  Claude Code:'));
      console.log(chalk.white('    • PostToolUse → nautalis ingest claude-event'));
      console.log(chalk.white('    • Stop → nautalis summarize-session'));
      console.log(chalk.white('    • SessionEnd → nautalis finalize-session'));
      console.log(chalk.white('    • SessionStart → nautalis inject-context'));
      console.log('');
    });
}
