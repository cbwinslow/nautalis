-- Fix embedding dimensions to match nomic-embed-text (768)
-- This migration adjusts memory_embeddings and knowledge_base_embeddings to vector(768)
-- It drops and recreates these tables to change dimension, losing any existing embeddings.
-- This is safe for early development; for production with data, a backup/restore is recommended.

-- Drop and recreate memory_embeddings with 768 dimensions
DROP TABLE IF EXISTS memory_embeddings CASCADE;

CREATE TABLE memory_embeddings (
    memory_id UUID PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate HNSW index for memory_embeddings
DROP INDEX IF EXISTS memory_embeddings_idx;
CREATE INDEX memory_embeddings_idx ON memory_embeddings USING hnsw (embedding vector_cosine_ops);

-- Drop and recreate knowledge_base_embeddings with 768 dimensions
DROP TABLE IF EXISTS knowledge_base_embeddings CASCADE;

CREATE TABLE knowledge_base_embeddings (
    kb_id UUID PRIMARY KEY REFERENCES knowledge_base(id) ON DELETE CASCADE,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate HNSW index for knowledge_base_embeddings
DROP INDEX IF EXISTS knowledge_base_embeddings_idx;
CREATE INDEX knowledge_base_embeddings_idx ON knowledge_base_embeddings USING hnsw (embedding vector_cosine_ops);
