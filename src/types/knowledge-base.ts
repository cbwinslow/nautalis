export type KbVisibility = 'public' | 'team' | 'project' | 'private';
export type KbContentType = 'markdown' | 'html' | 'plain_text' | 'code';
export type KbSource = 'manual' | 'auto_extracted' | 'ai_generated' | 'imported';

export interface KnowledgeBaseEntry {
  id: string;
  teamId: string;
  projectId?: string;
  createdById?: string;
  title: string;
  content: string;
  contentType: KbContentType;
  category?: string;
  tags: string[];
  topics: string[];
  visibility: KbVisibility;
  version: number;
  parentVersionId?: string;
  source: KbSource;
  sourceAgentId?: string;
  confidence: number;
  isPublished: boolean;
  isArchived: boolean;
  viewCount: number;
  lastViewedAt?: Date;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseHistory {
  id: string;
  kbId: string;
  userId?: string;
  agentId?: string;
  changeType: 'create' | 'update' | 'publish' | 'archive';
  oldContent?: string;
  newContent?: string;
  changeSummary?: string;
  createdAt: Date;
}

export interface KnowledgeBaseQuery {
  query: string;
  teamId: string;
  projectId?: string;
  category?: string;
  tags?: string[];
  visibility?: KbVisibility;
  embedding?: number[];
  limit?: number;
  includeArchived?: boolean;
}
