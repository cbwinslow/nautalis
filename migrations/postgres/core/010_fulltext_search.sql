-- Full-Text Search using triggers (规避immutable function限制)
-- Add tsvector column and maintain via triggers for memories, knowledge_base, events

-- ========== MEMORIES ==========
ALTER TABLE memories ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update memories search_vector
CREATE OR REPLACE FUNCTION update_memories_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.detail, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.topics, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for memories
DROP TRIGGER IF EXISTS memories_search_vector_trigger ON memories;
CREATE TRIGGER memories_search_vector_trigger
BEFORE INSERT OR UPDATE ON memories
FOR EACH ROW
EXECUTE FUNCTION update_memories_search_vector();

-- Backfill existing rows
UPDATE memories SET search_vector =
  setweight(to_tsvector('english', COALESCE(summary, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(detail, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(topics, ' '), '')), 'C')
WHERE search_vector IS NULL;

-- GIN index on memories.search_vector
CREATE INDEX IF NOT EXISTS memories_fts_idx ON memories USING GIN (search_vector);


-- ========== KNOWLEDGE_BASE ==========
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update knowledge_base search_vector
CREATE OR REPLACE FUNCTION update_kb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for knowledge_base
DROP TRIGGER IF EXISTS kb_search_vector_trigger ON knowledge_base;
CREATE TRIGGER kb_search_vector_trigger
BEFORE INSERT OR UPDATE ON knowledge_base
FOR EACH ROW
EXECUTE FUNCTION update_kb_search_vector();

-- Backfill existing rows
UPDATE knowledge_base SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'C')
WHERE search_vector IS NULL;

-- GIN index on knowledge_base.search_vector
CREATE INDEX IF NOT EXISTS knowledge_base_fts_idx ON knowledge_base USING GIN (search_vector);


-- ========== EVENTS ==========
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update events search_vector
CREATE OR REPLACE FUNCTION update_events_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.tool_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.decisions, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.errors, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.topics, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for events
DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;
CREATE TRIGGER events_search_vector_trigger
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_events_search_vector();

-- Backfill existing rows
UPDATE events SET search_vector =
  setweight(to_tsvector('english', COALESCE(tool_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(decisions, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(errors, ' '), '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(topics, ' '), '')), 'D')
WHERE search_vector IS NULL;

-- GIN index on events.search_vector
CREATE INDEX IF NOT EXISTS events_fts_idx ON events USING GIN (search_vector);
