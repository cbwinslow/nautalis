import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { getStore } from '../store/factory.js';
import chalk from 'chalk';
import ora from 'ora';

export function registerTeamCommand(program: Command): void {
  const teamCmd = program.command('team').description('Manage teams');

  teamCmd
    .command('create <name>')
    .description('Create a new team')
    .option('--slug <slug>', 'Team slug (auto-generated from name if not provided)')
    .action(async (name: string, options: { slug?: string }) => {
      const spinner = ora('Creating team...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        const user = await store.getUser(config.general.userId);
        if (!user) {
          throw new Error('Current user not found. Please run nautalis init first.');
        }

        const slug =
          options.slug ||
          name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');

        const team = await store.createTeam({
          name,
          slug,
          ownerId: user.id,
        });

        spinner.succeed(chalk.green(`Team "${team.name}" created successfully!`));
        console.log(chalk.gray(`  Team ID: ${team.id}`));
        console.log(chalk.gray(`  Slug: ${team.slug}`));
        console.log(chalk.gray(`  Created: ${team.createdAt.toISOString()}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to create team: ${error}`));
        process.exit(1);
      }
    });

  teamCmd
    .command('list')
    .description('List teams for current user')
    .action(async () => {
      const spinner = ora('Loading teams...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        const teams = await store.getTeamsForUser(config.general.userId);

        spinner.stop();

        if (teams.length === 0) {
          console.log(
            chalk.yellow(
              'No teams found. Create your first team with: nautalis team create <name>',
            ),
          );
          return;
        }

        console.log(chalk.cyan('\n  Your teams:\n'));

        for (const team of teams) {
          console.log(chalk.bold(`  • ${team.name} (${team.slug})`));
          console.log(chalk.gray(`    ID: ${team.id}`));
          console.log(chalk.gray(`    Created: ${team.createdAt.toISOString()}`));
          console.log('');
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to list teams: ${error}`));
        process.exit(1);
      }
    });

   teamCmd
     .command('info <team>')
     .description('Show team information and members')
     .action(async (teamIdentifier: string) => {
       const spinner = ora('Loading team info...').start();

       try {
         const config = await loadConfig();
         const store = await getStore(config);
         await store.init();

         // Try to get team by ID first, then by slug
         let team = await store.getTeam(teamIdentifier, { userId: config.general.userId });
         if (!team) {
           team = await store.getTeamBySlug(teamIdentifier);
         }

         if (!team) {
           throw new Error(`Team "${teamIdentifier}" not found`);
         }

         const members = await store.getTeamMembers(team.id, { userId: config.general.userId });

         spinner.stop();

         console.log(chalk.cyan(`\n  Team: ${team.name}`));
         console.log(chalk.gray(`  Slug: ${team.slug}`));
         console.log(chalk.gray(`  ID: ${team.id}`));
         console.log(chalk.gray(`  Created: ${team.createdAt.toISOString()}`));
         console.log(chalk.gray(`  Members: ${members.length}`));
         console.log('');

         if (members.length > 0) {
           console.log(chalk.bold('  Members:'));
           for (const member of members) {
             const roleColor =
               member.role === 'owner'
                 ? chalk.magenta
                 : member.role === 'admin'
                   ? chalk.red
                   : member.role === 'manager'
                     ? chalk.yellow
                     : member.role === 'member'
                       ? chalk.blue
                       : chalk.gray;
             console.log(
               `    ${roleColor(member.role)} ${member.name || member.email} (${member.userId})`,
             );
           }
         }
       } catch (error) {
         spinner.fail(chalk.red(`Failed to get team info: ${error}`));
         process.exit(1);
       }
     });

  teamCmd
    .command('invite <email>')
    .description('Invite a user to the current team')
    .option('--role <role>', 'Role to assign (member, manager, admin)', 'member')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (email: string, options: { role: string; team?: string }) => {
      const spinner = ora('Inviting user...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        const teamId = options.team || config.general.teamId;
        if (!teamId) {
          throw new Error('No team specified. Use --team or set current team in config.');
        }

        // Get or create user
        let user = await store.getUserByEmail(email);
        if (!user) {
          user = await store.createUser({ email, name: email.split('@')[0] });
        }

         // Check if already a member
         const members = await store.getTeamMembers(teamId, { userId: config.general.userId });
         const existingMember = members.find((m) => m.userId === user.id);
         if (existingMember) {
           throw new Error(`User ${email} is already a member of this team`);
         }

         await store.addTeamMember(teamId, user.id, options.role, { actingUserId: config.general.userId });

        spinner.succeed(chalk.green(`User ${email} invited to team as ${options.role}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to invite user: ${error}`));
        process.exit(1);
      }
    });

  teamCmd
    .command('role <userId> <role>')
    .description("Update a team member's role")
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (userId: string, role: string, options: { team?: string }) => {
      const spinner = ora('Updating member role...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        const teamId = options.team || config.general.teamId;
        if (!teamId) {
          throw new Error('No team specified. Use --team or set current team in config.');
        }

         await store.updateMemberRole(teamId, userId, role, { actingUserId: config.general.userId });

        spinner.succeed(chalk.green(`Member role updated to ${role}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to update member role: ${error}`));
        process.exit(1);
      }
    });

  teamCmd
    .command('remove <userId>')
    .description('Remove a member from the team')
    .option('--team <team>', 'Team ID or slug (uses current team if not specified)')
    .action(async (userId: string, options: { team?: string }) => {
      const spinner = ora('Removing member...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

        const teamId = options.team || config.general.teamId;
        if (!teamId) {
          throw new Error('No team specified. Use --team or set current team in config.');
        }

         await store.removeTeamMember(teamId, userId, { actingUserId: config.general.userId });

        spinner.succeed(chalk.green('Member removed from team'));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to remove member: ${error}`));
        process.exit(1);
      }
    });

  teamCmd
    .command('members <team>')
    .description('List team members')
    .action(async (teamIdentifier: string) => {
      const spinner = ora('Loading team members...').start();

      try {
        const config = await loadConfig();
        const store = await getStore(config);
        await store.init();

         // Try to get team by ID first, then by slug
         let team = await store.getTeam(teamIdentifier, { userId: config.general.userId });
         if (!team) {
           team = await store.getTeamBySlug(teamIdentifier);
         }

         if (!team) {
           throw new Error(`Team "${teamIdentifier}" not found`);
         }

         const members = await store.getTeamMembers(team.id, { userId: config.general.userId });

        spinner.stop();

        console.log(chalk.cyan(`\n  Members of ${team.name}:\n`));

        if (members.length === 0) {
          console.log(chalk.yellow('  No members found'));
          return;
        }

        for (const member of members) {
          const roleColor =
            member.role === 'owner'
              ? chalk.magenta
              : member.role === 'admin'
                ? chalk.red
                : member.role === 'manager'
                  ? chalk.yellow
                  : member.role === 'member'
                    ? chalk.blue
                    : chalk.gray;
          console.log(
            `  ${roleColor(member.role)} ${member.name || member.email} (${member.userId})`,
          );
          console.log(chalk.gray(`    Joined: ${member.joinedAt.toISOString()}`));
          console.log('');
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to list members: ${error}`));
        process.exit(1);
      }
    });
}
