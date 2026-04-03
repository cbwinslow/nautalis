-- Function: Set current team context (call at start of each session)
CREATE OR REPLACE FUNCTION set_current_team(p_team_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_team_id', p_team_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- Function: Get user's role in a team
CREATE OR REPLACE FUNCTION get_user_role(p_team_id UUID, p_user_id UUID)
RETURNS team_role AS $$
    SELECT role FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND is_active = true;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function: Check if user has permission
CREATE OR REPLACE FUNCTION can(p_user_id UUID, p_scope permission_scope, p_action permission_action)
RETURNS BOOLEAN AS $$
    SELECT has_permission(p_user_id, current_setting('app.current_team_id')::UUID, p_scope, p_action);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function: Update memory access tracking
CREATE OR REPLACE FUNCTION track_memory_access(p_memory_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE memories
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Find similar memories (vector search)
CREATE OR REPLACE FUNCTION find_similar_memories(
    p_embedding vector(384),
    p_team_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_min_score REAL DEFAULT 0.7
)
RETURNS TABLE(
    memory_id UUID,
    summary TEXT,
    memory_type memory_type,
    importance REAL,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.id, m.summary, m.memory_type, m.importance,
           1 - (me.embedding <=> p_embedding) AS similarity
    FROM memory_embeddings me
    JOIN memories m ON m.id = me.memory_id
    WHERE m.team_id = p_team_id
    AND m.is_stale = false
    AND 1 - (me.embedding <=> p_embedding) >= p_min_score
    ORDER BY me.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Search knowledge base
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
               ts_rank(to_tsvector('english', kb.title || ' ' || kb.content), plainto_tsquery('english', p_query)) AS similarity,
               kb.view_count
        FROM knowledge_base kb
        WHERE kb.team_id = p_team_id
        AND kb.is_published = true
        AND kb.is_archived = false
        AND (p_category IS NULL OR kb.category = p_category)
        AND to_tsvector('english', kb.title || ' ' || kb.content) @@ plainto_tsquery('english', p_query)
        ORDER BY ts_rank DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-stale old memories
CREATE OR REPLACE FUNCTION auto_stale_memories()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    UPDATE memories
    SET is_stale = true
    WHERE is_stale = false
    AND (
        (ttl IS NOT NULL AND ttl < NOW())
        OR (decay_rate > 0 AND access_count = 0 AND created_at < NOW() - INTERVAL '30 days')
    );
    
    GET DIAGNOSTICS count = ROW_COUNT;
    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get team dashboard stats
CREATE OR REPLACE FUNCTION get_team_dashboard(p_team_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_members', (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND is_active = true),
        'total_projects', (SELECT COUNT(*) FROM projects WHERE team_id = p_team_id AND is_active = true),
        'total_agents', (SELECT COUNT(*) FROM agents WHERE team_id = p_team_id AND is_active = true),
        'total_memories', (SELECT COUNT(*) FROM memories WHERE team_id = p_team_id),
        'total_events_24h', (SELECT COUNT(*) FROM events WHERE team_id = p_team_id AND timestamp > NOW() - INTERVAL '24 hours'),
        'total_events_7d', (SELECT COUNT(*) FROM events WHERE team_id = p_team_id AND timestamp > NOW() - INTERVAL '7 days'),
        'total_errors_24h', (SELECT COUNT(*) FROM events WHERE team_id = p_team_id AND timestamp > NOW() - INTERVAL '24 hours' AND event_type = 'error'),
        'knowledge_base_entries', (SELECT COUNT(*) FROM knowledge_base WHERE team_id = p_team_id AND is_published = true),
        'active_sessions', (SELECT COUNT(*) FROM sessions WHERE team_id = p_team_id AND status = 'active')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
