export interface TeamMember {
  userId: string;
  name: string;
  email?: string;
  role: 'member' | 'admin' | 'owner';
  joinedAt: Date;
  lastActive: Date;
  activeAgents: string[];
}

export interface TeamActivity {
  id: string;
  userId: string;
  userName: string;
  agentTool: string;
  projectId: string;
  action: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface ConflictAlert {
  id: string;
  type: 'file_overlap' | 'topic_overlap' | 'resource_conflict';
  severity: 'low' | 'medium' | 'high';
  users: string[];
  details: {
    files?: string[];
    topics?: string[];
    description: string;
  };
  detectedAt: Date;
  resolved: boolean;
}
