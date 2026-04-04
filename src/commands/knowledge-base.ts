import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import type { KnowledgeBaseEntry, KbVisibility, KbContentType } from '../types/knowledge-base.js';
import type { KBEntry } from '../store/postgres/knowledge-base.js';
import chalk from 'chalk';
import ora from 'ora';
import { formatDistanceToNow } from 'date-fns';

export function registerKnowledgeBaseCommand(program: Command): void {
  const kbCmd = program.command('knowledge-base').description('Manage knowledge base');

  kbCmd
    .command('create <title>')
    .description('Create a new knowledge base entry')
    .argument('<content>', 'Entry content')
    .option('--category <category>', 'Category for the entry')
    .option('--tags <tags>', 'Comma-separated tags')
    .option(
      '--visibility <visibility>',
      'Visibility level (public, team, project, private)',
      'team',
    )
    .option('--content-type <type>', 'Content type (markdown, html, plain_text, code)', 'markdown')
    .option('--project <projectId>', 'Project ID')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(
      async (
        title: string,
        content: string,
        options: {
          category?: string;
          tags?: string;
          visibility?: string;
          contentType?: string;
          project?: string;
          team?: string;
        },
      ) => {
        const spinner = ora('Creating knowledge base entry...').start();

        try {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

          const tags = options.tags ? options.tags.split(',').map((t) => t.trim()) : [];

           const entry: KBEntry = {
             teamId,
             projectId: options.project,
             title,
             content,
             contentType: options.contentType || 'markdown',
             category: options.category,
             tags,
             topics: [], // Will be auto-generated
             visibility: options.visibility || 'team',
             source: 'manual',
             confidence: 1.0,
             createdById: config.general.userId,
           };

           const id = await store.createKnowledgeBase(entry as KnowledgeBaseEntry, { userId: config.general.userId });

          spinner.succeed(chalk.green(`Knowledge base entry created successfully!`));
          console.log(chalk.gray(`  ID: ${id}`));
          console.log(chalk.gray(`  Title: ${title}`));
          console.log(chalk.gray(`  Category: ${options.category || 'N/A'}`));
          console.log(chalk.gray(`  Tags: ${tags.join(', ') || 'N/A'}`));
          console.log(chalk.gray(`  Visibility: ${options.visibility}`));
        } catch (error) {
          spinner.fail(chalk.red(`Failed to create knowledge base entry: ${error}`));
          process.exit(1);
        }
      },
    );

  kbCmd
    .command('search <query>')
    .description('Search knowledge base entries')
    .option('--category <category>', 'Filter by category')
    .option('--limit <n>', 'Maximum results', '20')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .option('--json', 'Output as JSON')
    .action(
      async (
        query: string,
        options: { category?: string; limit?: string; team?: string; json?: boolean },
      ) => {
        const spinner = ora(`Searching knowledge base for "${query}"...`).start();

        try {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

           const results = await store.searchKnowledgeBase(teamId, query, undefined, {
             category: options.category,
             limit: parseInt(options.limit || '20'),
             userId: config.general.userId,
           });

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
          }

          if (results.length === 0) {
            console.log(chalk.yellow('No results found'));
            return;
          }

          console.log(chalk.cyan(`\n  Found ${results.length} results for "${query}":\n`));

          for (const entry of results) {
            console.log(chalk.bold(`  ┌─ ${entry.title}`));
            console.log(chalk.gray(`  │ Category: ${entry.category || 'N/A'}`));
            console.log(chalk.gray(`  │ Tags: ${entry.tags.join(', ') || 'N/A'}`));
            console.log(chalk.gray(`  │ Visibility: ${entry.visibility}`));
            console.log(chalk.gray(`  │ Content type: ${entry.contentType}`));
            console.log(chalk.gray(`  │ ${formatDistanceToNow(entry.updatedAt)} ago`));
            console.log(chalk.bold(`  └─\n`));
          }
        } catch (error) {
          spinner.fail(chalk.red(`Search failed: ${error}`));
          process.exit(1);
        }
      },
    );

  kbCmd
    .command('list')
    .description('List knowledge base entries')
    .option('--category <category>', 'Filter by category')
    .option('--visibility <visibility>', 'Filter by visibility')
    .option('--limit <n>', 'Maximum results', '50')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .option('--json', 'Output as JSON')
    .action(
      async (options: {
        category?: string;
        visibility?: string;
        limit?: string;
        team?: string;
        json?: boolean;
      }) => {
        const spinner = ora('Loading knowledge base entries...').start();

        try {
          const config = await loadConfig();
          const store = await getStore(config);
          await store.init();

          const teamId = options.team || config.general.teamId;
          if (!teamId) {
            throw new Error('No team specified. Use --team or set current team in config.');
          }

           const query = {
             query: '',
             teamId,
             category: options.category,
             visibility: options.visibility as KbVisibility,
             limit: parseInt(options.limit || '50'),
             includeArchived: false,
             userId: config.general.userId,
           };

          const results = await store.queryKnowledgeBase(query);

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
            return;
          }

          if (results.length === 0) {
            console.log(chalk.yellow('No knowledge base entries found'));
            return;
          }

          console.log(chalk.cyan(`\n  Knowledge Base Entries (${results.length}):\n`));

          for (const entry of results) {
            const visibilityColor =
              entry.visibility === 'public'
                ? chalk.green
                : entry.visibility === 'team'
                  ? chalk.blue
                  : entry.visibility === 'project'
                    ? chalk.yellow
                    : chalk.red;
            console.log(chalk.bold(`  • ${entry.title}`));
            console.log(chalk.gray(`    ID: ${entry.id}`));
            console.log(chalk.gray(`    Category: ${entry.category || 'N/A'}`));
            console.log(chalk.gray(`    Tags: ${entry.tags.join(', ') || 'N/A'}`));
            console.log(`${chalk.gray('    Visibility:')} ${visibilityColor(entry.visibility)}`);
            console.log(chalk.gray(`    Updated: ${formatDistanceToNow(entry.updatedAt)} ago`));
            console.log('');
          }
        } catch (error) {
          spinner.fail(chalk.red(`Failed to list knowledge base entries: ${error}`));
          process.exit(1);
        }
      },
    );

   kbCmd
     .command('get <id>')
     .description('Get a specific knowledge base entry')
     .option('--json', 'Output as JSON')
     .action(async (id: string, options: { json?: boolean }) => {
       const spinner = ora('Loading knowledge base entry...').start();

       try {
         const config = await loadConfig();
         const store = await getStore(config);
         await store.init();

         const entry = await store.getKnowledgeBase(id, { userId: config.general.userId });

         if (!entry) {
           spinner.fail(chalk.red(`Knowledge base entry with ID "${id}" not found`));
           process.exit(1);
         }

         spinner.stop();

         if (options.json) {
           console.log(JSON.stringify(entry, null, 2));
           return;
         }

         console.log(chalk.cyan(`\n  Knowledge Base Entry\n`));
        console.log(chalk.bold(`  Title: ${entry.title}`));
        console.log(chalk.gray(`  ID: ${entry.id}`));
        console.log(chalk.gray(`  Team: ${entry.teamId}`));
        if (entry.projectId) {
          console.log(chalk.gray(`  Project: ${entry.projectId}`));
        }
        console.log(chalk.gray(`  Category: ${entry.category || 'N/A'}`));
        console.log(chalk.gray(`  Tags: ${entry.tags.join(', ') || 'N/A'}`));
        console.log(chalk.gray(`  Topics: ${entry.topics.join(', ') || 'N/A'}`));
        console.log(chalk.gray(`  Visibility: ${entry.visibility}`));
        console.log(chalk.gray(`  Content Type: ${entry.contentType}`));
        console.log(chalk.gray(`  Source: ${entry.source}`));
        console.log(chalk.gray(`  Version: ${entry.version}`));
        console.log(chalk.gray(`  Published: ${entry.isPublished ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`  Archived: ${entry.isArchived ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`  View Count: ${entry.viewCount}`));
        console.log(chalk.gray(`  Created: ${entry.createdAt.toISOString()}`));
        console.log(chalk.gray(`  Updated: ${entry.updatedAt.toISOString()}`));
        if (entry.lastViewedAt) {
          console.log(chalk.gray(`  Last Viewed: ${entry.lastViewedAt.toISOString()}`));
        }
        console.log('');
        console.log(chalk.bold('  Content:'));
        console.log(
          chalk.gray('  ─────────────────────────────────────────────────────────────────'),
        );
        console.log(entry.content);
      } catch (error) {
        spinner.fail(chalk.red(`Failed to get knowledge base entry: ${error}`));
        process.exit(1);
      }
    });

  kbCmd
    .command('delete <id>')
    .description('Delete a knowledge base entry')
    .option('--force', 'Skip confirmation prompt')
    .action(async (id: string, options: { force?: boolean }) => {
      const spinner = ora('Deleting knowledge base entry...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

         // Get the entry first to show what we're deleting
         const entry = await store.getKnowledgeBase(id, { userId: config.general.userId });
         if (!entry) {
           spinner.fail(chalk.red(`Knowledge base entry with ID "${id}" not found`));
           process.exit(1);
         }

         if (!options.force) {
           spinner.stop();
           console.log(chalk.yellow(`Are you sure you want to delete "${entry.title}"? (y/N)`));
           process.stdin.setRawMode(true);
           process.stdin.resume();
           const key = await new Promise<string>((resolve) => {
             process.stdin.once('data', (data) => {
               resolve(data.toString());
             });
           });
           process.stdin.setRawMode(false);
           process.stdin.pause();

           if (key.toLowerCase() !== 'y' && key !== '\r') {
             console.log(chalk.gray('Operation cancelled'));
             return;
           }
           spinner.start();
         }

         await store.deleteKnowledgeBase(id, { userId: config.general.userId });

        spinner.succeed(chalk.green(`Knowledge base entry "${entry.title}" deleted successfully`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to delete knowledge base entry: ${error}`));
        process.exit(1);
      }
    });
}
