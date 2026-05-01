-- Story 7.1 / Architecture A13 — pgvector HNSW indexes.
--
-- Built CONCURRENTLY so the index build doesn't lock writes on the
-- embedding tables. CONCURRENTLY can't run inside a transaction, so
-- this migration uses the `_no_tx.sql` suffix per CLAUDE.md migration
-- policy.
--
-- HNSW parameters per pgvector docs:
--   - m = 16: graph connectivity (default)
--   - ef_construction = 64: build-time accuracy (default)
-- Cosine similarity is the operator family for `vector_cosine_ops`.
-- The retriever uses `<=>` (cosine distance) — smaller is closer.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_1536_hnsw
  ON embeddings_1536 USING hnsw (embedding vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_1024_hnsw
  ON embeddings_1024 USING hnsw (embedding vector_cosine_ops);
