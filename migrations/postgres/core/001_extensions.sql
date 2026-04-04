-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector for embeddings
-- Timescaledb may not be installed in dev; create only if available
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS "timescaledb";
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN index support
