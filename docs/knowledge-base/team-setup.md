# Team Setup

Guide to configuring Nautalis for multi-user team deployments with shared memory, conflict detection, and activity awareness.

## Overview

Team setup transforms Nautalis from a personal tool into a shared platform:

- **Shared Memory Store** — All team members read/write to the same database
- **Cross-Agent Visibility** — See what any agent on the team has done
- **Conflict Detection** — Automatic alerts for overlapping work
- **Activity Feeds** — Real-time team activity awareness
- **Project Scoping** — Organize memories by project

## Prerequisites

- PostgreSQL with pgvector (or Supabase)
- Shared embedding provider (OpenAI API recommended for teams)
- Network connectivity between team members

## Core Configuration

```toml
[team]
enabled = true
projectId = "your-project-id"
teamName = "Your Team Name"

[team.conflictDetection]
enabled = true
sensitivity = "medium"
notifyOnConflict = true

[team.activityFeed]
enabled = true
maxAge = "7d"
```

## Shared Storage

All team members must point to the same storage backend:

```toml
[storage]
backend = "postgresql"

[storage.postgresql]
host = "db.team.internal"
port = 5432
database = "nautalis"
username = "nautalis"
password = "${POSTGRES_PASSWORD}"
poolSize = 20
ssl = true
```

## Conflict Detection

### How It Works

Conflict detection monitors memory creation and identifies potential conflicts:

1. **File Overlap** — Two agents editing the same files within a time window
2. **Decision Contradiction** — New decisions that contradict existing ones
3. **Pattern Divergence** — Different approaches to the same problem
4. **Resource Competition** — Competing modifications to shared resources

### Sensitivity Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| `low` | Only flag direct file conflicts | Large teams, many parallel projects |
| `medium` | Flag file + decision conflicts | Default for most teams |
| `high` | Flag all potential conflicts | Small teams, tightly coupled work |

### Notification Channels

```toml
[team.conflictDetection.notifications]
slack = true
slackWebhook = "${SLACK_WEBHOOK_URL}"
email = true
emailRecipients = ["team@company.com"]
inApp = true
```

## Activity Feed

The activity feed provides real-time visibility:

```bash
# View team activity
nautalis team activity

# Filter by member
nautalis team activity --member alice

# Filter by agent
nautalis team activity --agent claude-code

# Filter by project
nautalis team activity --project my-app
```

### Feed Events

| Event | Description |
|-------|-------------|
| `memory.created` | New memory ingested |
| `memory.updated` | Memory modified |
| `conflict.detected` | Conflict identified |
| `session.started` | New AI session started |
| `session.ended` | AI session completed |
| `decision.made` | Decision memory created |

## Project Management

### Create a Project

```bash
nautalis team project create --name "My App" --id "my-app"
```

### Switch Project Context

```bash
nautalis config set team.projectId "my-app"
```

### View Project Statistics

```bash
nautalis team project stats --id "my-app"
```

## Member Management

### Add Team Member

```bash
nautalis team member add --email "alice@company.com" --role "developer"
```

### Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access, member management, configuration |
| `developer` | Read/write memories, view activity |
| `viewer` | Read-only access to memories and activity |

### List Members

```bash
nautalis team members list
```

## Shared Context Injection

When a team member starts a session, they can inject team-wide context:

```bash
# Include team activity in context
nautalis context --include-team

# Include conflict warnings
nautalis context --include-conflicts

# Project-scoped team context
nautalis context --project my-app --include-team
```

## Best Practices

1. **Use a shared embedding provider** — Ensures consistent vector dimensions
2. **Set project IDs** — Scope memories to specific projects
3. **Enable conflict detection** — Start with medium sensitivity
4. **Review activity feeds** — Daily check-ins for team awareness
5. **Use consistent naming** — Standardize project and team names
6. **Set appropriate retention** — Balance storage costs with knowledge preservation

## Next Steps

- [Team Deployment Guide](../guides/team-deployment.md)
- [Enterprise Setup](../guides/enterprise-setup.md)
- [Storage Backends](storage-backends.md)
