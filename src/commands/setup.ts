import { Command } from 'commander';
import { initTelemetry } from '../telemetry/provider.js';
import { withSpan } from '../telemetry/api.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard (TUI)')
    .action(async () => {
      initTelemetry();
      const spinner = ora('Detecting AI tools...').start();
      
      try {
        await withSpan('nautalis.command.setup', {}, async () => {
          console.log(chalk.cyan('\n  🐙 Nautalis Setup Wizard\n'));
          console.log(chalk.gray('  Scanning your system...\n'));
          
          // TODO: Implement full TUI wizard with ink
          // For now, show detection results
          
          const tools: Array<{ name: string; found: boolean; details?: string }> = [
            { name: 'Claude Code', found: false },
            { name: 'Kilo Code', found: false },
            { name: 'OpenCode', found: false },
            { name: 'Cursor', found: false },
            { name: 'Windsurf', found: false },
          ];
          
          // Check for tool installations
          // TODO: Implement actual detection
          
          spinner.stop();
          
          console.log(chalk.cyan('\n  Detected AI tools:\n'));
          for (const tool of tools) {
            const icon = tool.found ? '✅' : '❌';
            console.log(`  ${icon} ${tool.name}`);
          }
          
          console.log(chalk.cyan('\n  Recommended setup:\n'));
          console.log(chalk.gray('  • Database: SQLite (personal use, zero config)'));
          console.log(chalk.gray('  • Embeddings: Ollama (local, free)'));
          console.log(chalk.gray('  • LLM: Ollama qwen2.5:3b (local, free)'));
          console.log('');
          console.log(chalk.gray('  Run ') + chalk.white('nautalis init') + chalk.gray(' to set up with these defaults.'));
          console.log('');
        });
      } catch (error) {
        spinner.fail(chalk.red(`Setup failed: ${error}`));
        throw error;
      }
    });
}
