import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logMessage, createSpan } from '../../telemetry/api.js';
import { SPAN_NAMES } from '../../types/telemetry.js';
import { KBEntrySchema } from '../../validation/schemas.js';

export interface KBEntry {
  id?: string;
  teamId: string;
  projectId?: string;
  createdById?: string;
  title: string;
  content: string;
  contentType?: string;
  category?: string;
  tags?: string[];
  topics?: string[];
  visibility?: string;
  source?: string;
  sourceAgentId?: string;
  confidence?: number;
  embedding?: number[];
}

export class KnowledgeBaseEngine {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async create(entry: KBEntry): Promise<string> {
    const id = entry.id || uuidv4();

    // Build full entry with defaults
    const fullEntry = {
      id,
      teamId: entry.teamId,
      projectId: entry.projectId || null,
      createdById: entry.createdById || null,
      title: entry.title,
      content: entry.content,
      contentType: entry.contentType || 'markdown',
      category: entry.category || null,
      tags: entry.tags || [],
      topics: entry.topics || [],
      visibility: entry.visibility || 'team',
      source: entry.source || 'manual',
      sourceAgentId: entry.sourceAgentId || null,
      confidence: entry.confidence ?? 1.0,
      isPublished: false,
      isArchived: false,
      viewCount: 0,
      lastViewedAt: null,
      embedding: entry.embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate full entry against schema
    KBEntrySchema.parse(fullEntry);

    await this.pool.query(
      `INSERT INTO knowledge_base (id, team_id, project_id, created_by, title, content, content_type, category, tags, topics, visibility, source, source_agent_id, confidence, is_published, is_archived, view_count, last_viewed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        fullEntry.id,
        fullEntry.teamId,
        fullEntry.projectId,
        fullEntry.createdById,
        fullEntry.title,
        fullEntry.content,
        fullEntry.contentType,
        fullEntry.category,
        fullEntry.tags,
        fullEntry.topics,
        fullEntry.visibility,
        fullEntry.source,
        fullEntry.sourceAgentId,
        fullEntry.confidence,
        fullEntry.isPublished,
        fullEntry.isArchived,
        fullEntry.viewCount,
        fullEntry.lastViewedAt,
        fullEntry.createdAt,
        fullEntry.updatedAt,
      ],
    );

    if (entry.embedding) {
      await this.pool.query(
        `INSERT INTO knowledge_base_embeddings (kb_id, embedding) VALUES ($1, $2::vector)`,
        [id, `[${entry.embedding.join(',')}]`],
      );
    }

    return id;
  }

  async get(id: string) {
    const result = await this.pool.query(`SELECT * FROM knowledge_base WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async query(query: any) {
    return [];
  }

  async update(id: string, updates: Partial<KBEntry>) {
    const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'embedding');
    if (fields.length === 0) return;

    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [
      id,
      ...fields.map((f) => {
        const value = updates[f as keyof KBEntry];
        return Array.isArray(value) ? value : value;
      }),
    ];

    await this.pool.query(
      `UPDATE knowledge_base SET ${setClauses}, version = version + 1, updated_at = NOW() WHERE id = $1`,
      values,
    );
  }

  async delete(id: string) {
    await this.pool.query(`DELETE FROM knowledge_base_embeddings WHERE kb_id = $1`, [id]);
    await this.pool.query(`DELETE FROM knowledge_base WHERE id = $1`, [id]);
  }

  async search(
    teamId: string,
    query: string,
    embedding?: number[],
    options?: { category?: string; limit?: number },
  ) {
    const span = createSpan(SPAN_NAMES.RAG_RETRIEVE + '.kb_search', {
      'kb.query': query,
      'kb.team': teamId,
    });

    try {
      if (embedding) {
        const result = await this.pool.query(
          `SELECT kb.*, 1 - (kbe.embedding <=> $1::vector) AS similarity
           FROM knowledge_base_embeddings kbe
           JOIN knowledge_base kb ON kb.id = kbe.kb_id
           WHERE kb.team_id = $2 AND kb.is_published = true AND kb.is_archived = false
           ${options?.category ? 'AND kb.category = $3' : ''}
           ORDER BY kbe.embedding <=> $1::vector
           LIMIT $${options?.category ? 4 : 3}`,
          embedding
            ? [
                `[${embedding.join(',')}]`,
                teamId,
                ...(options?.category ? [options.category] : []),
                options?.limit || 10,
              ]
            : [teamId, options?.limit || 10],
        );

        span.end();
        return result.rows;
      } else {
        const result = await this.pool.query(
          `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
           FROM knowledge_base
           WHERE team_id = $2 AND is_published = true AND is_archived = false
           AND search_vector @@ plainto_tsquery('english', $1)
           ORDER BY rank DESC
           LIMIT $3`,
          [query, teamId, options?.limit || 10],
        );

        span.end();
        return result.rows;
      }
    } catch (error) {
      span.end(error as Error);
      throw error;
    }
  }
}
