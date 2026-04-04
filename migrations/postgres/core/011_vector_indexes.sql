-- Vector similarity indexes using HNSW (no training data required)
-- Replaces ivfflat indexes

-- Memory embeddings
CREATE INDEX IF NOT EXISTS memory_embeddings_idx ON memory_embeddings USING hnsw (embedding vector_cosine_ops);

-- Knowledge base embeddings
CREATE INDEX IF NOT EXISTS knowledge_base_embeddings_idx ON knowledge_base_embeddings USING hnsw (embedding vector_cosine_ops);
