import type { Memory, MemoryQueryResult } from './memory.js';

export interface AgentContext {
  userId: string;
  sessionId: string;
  projectId?: string;

  recentActivity: {
    whatYouWorkedOnYesterday: string[];
    teammateActivity: string[];
    relevantDecisions: string[];
  };

  relevantMemories: MemoryQueryResult[];

  projectContext?: {
    repoPath: string;
    branch: string;
    recentCommits: string[];
    activeFiles: string[];
  };

  formattedContext: string;
}
