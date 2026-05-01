-- Story 7.1 / Architecture A13 — pgvector HNSW indexed embedding tables.
--
-- Two tables, one per dimension family:
--   - embeddings_1536: text-embedding-3-small + Azure OpenAI HIPAA path
--   - embeddings_1024: Voyage / bge-m3 (EU + medical tenants)
--
-- Each table is tenant-scoped (RLS) with FK CASCADE from `meetings` so
-- erasure flows automatically when a meeting goes.
--
-- HNSW index is created CONCURRENTLY in a follow-up migration with the
-- `_no_tx.sql` suffix per CLAUDE.md migration policy. This migration
-- ships the table + the regular indexes; the HNSW index lands separately
-- so it doesn't lock writes during the build.
--
-- Forward-only.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings_1536 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  chunk_key TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  model_id TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_embeddings_1536_tenant_chunk
  ON embeddings_1536 (tenant_id, chunk_key);
CREATE INDEX idx_embeddings_1536_tenant_meeting
  ON embeddings_1536 (tenant_id, meeting_id);

CREATE TABLE embeddings_1024 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  chunk_key TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_text TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  model_id TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_embeddings_1024_tenant_chunk
  ON embeddings_1024 (tenant_id, chunk_key);
CREATE INDEX idx_embeddings_1024_tenant_meeting
  ON embeddings_1024 (tenant_id, meeting_id);
