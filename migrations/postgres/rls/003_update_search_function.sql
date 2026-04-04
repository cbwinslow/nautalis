-- Update search_knowledge_base to use generated search_vector column
CREATE OR REPLACE FUNCTION search_knowledge_base(
    p_query TEXT,
    p_team_id UUID,
    p_embedding vector(384) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_category VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    kb_id UUID,
    title VARCHAR,
    content TEXT,
    category VARCHAR,
    tags TEXT[],
    similarity REAL,
    view_count INTEGER
) AS $$
BEGIN
    IF p_embedding IS NOT NULL THEN
        RETURN QUERY
        SELECT kb.id, kb.title, kb.content, kb.category, kb.tags,
               1 - (kbe.embedding <=> p_embedding) AS similarity,
               kb.view_count
        FROM knowledge_base_embeddings kbe
        JOIN knowledge_base kb ON kb.id = kbe.kb_id
        WHERE kb.team_id = p_team_id
          AND kb.is_published = true
          AND kb.is_archived = false
          AND (p_category IS NULL OR kb.category = p_category)
          AND (
              kb.visibility = 'public'
              OR (kb.visibility = 'team' AND kb.team_id = p_team_id)
          )
        ORDER BY kbe.embedding <=> p_embedding
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT kb.id, kb.title, kb.content, kb.category, kb.tags,
               ts_rank(kb.search_vector, plainto_tsquery('english', p_query)) AS similarity,
               kb.view_count
        FROM knowledge_base kb
        WHERE kb.team_id = p_team_id
          AND kb.is_published = true
          AND kb.is_archived = false
          AND (p_category IS NULL OR kb.category = p_category)
          AND kb.search_vector @@ plainto_tsquery('english', p_query)
        ORDER BY ts_rank DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
