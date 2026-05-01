import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';

/**
 * `embeddings_1536` + `embeddings_1024` — Story 7.1 (Architecture A13 / Gap S1).
 *
 * Per-dimension vector tables so the embedding model can swap without
 * a schema migration. `text-embedding-3-small` produces 1536-dim
 * vectors (US tenants via Azure for HIPAA); Voyage / bge-m3 produce
 * 1024-dim (EU + medical tenants).
 *
 * The HNSW index lives in pgvector. Drizzle's pgvector support is via
 * `customType` — we declare the column type as `vector(N)` and let
 * the DB enforce the dimension at insert time.
 *
 * Tenant-scoped (RLS). Erasure cascade: `cascade` (FK ON DELETE
 * CASCADE from `meetings` removes embeddings when the meeting goes).
 *
 * Story 7.2 follow-up: the indexer worker chunks transcripts and
 * upserts rows here; the search repository queries
 * `<vector> <=> <query>` for cosine similarity.
 */

// Custom Drizzle type for pgvector. The dimension is bound at column
// declaration time so the DB rejects writes with the wrong shape.
const vectorColumn = (dim: 1024 | 1536) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dim})`,
    toDriver: (value) => `[${value.join(',')}]`,
    fromDriver: (raw) => {
      const stripped = raw.replace(/^\[|\]$/g, '');
      return stripped.split(',').map(Number);
    },
  });

const VECTOR_1536 = vectorColumn(1536);
const VECTOR_1024 = vectorColumn(1024);

const buildEmbeddingsTable = (tableName: 'embeddings_1536' | 'embeddings_1024', dim: 1024 | 1536) =>
  pgTable(
    tableName,
    {
      id: uuid('id').primaryKey().defaultRandom(),
      tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
      meetingId: uuid('meeting_id')
        .notNull()
        .references(() => meetings.id, { onDelete: 'cascade' }),
      /** Logical chunk id (e.g. `meetingId:chunk-3`) — stable for upsert. */
      chunkKey: text('chunk_key').notNull(),
      /**
       * Source kind — drives retrieval-time slicing. `'transcript'`
       * embeds raw speaker-turn text; `'summary'` embeds the analysis
       * summary; `'action-item'` embeds individual commitments.
       */
      sourceKind: text('source_kind').notNull(),
      /** Raw text the embedding was computed from (for debugging + RAG context join). */
      sourceText: text('source_text').notNull(),
      /** Vector column — bound to the table's dimension. */
      embedding:
        dim === 1536 ? VECTOR_1536('embedding').notNull() : VECTOR_1024('embedding').notNull(),
      /** Embedding model id at write time — e.g. `'text-embedding-3-small'`. */
      modelId: text('model_id').notNull(),
      tokenCount: integer('token_count').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
      uqEmbeddingsChunk: uniqueIndex(`uq_${tableName}_tenant_chunk`).on(t.tenantId, t.chunkKey),
      idxEmbeddingsTenantMeeting: index(`idx_${tableName}_tenant_meeting`).on(
        t.tenantId,
        t.meetingId,
      ),
    }),
  );

export const embeddings1536 = buildEmbeddingsTable('embeddings_1536', 1536);
export const embeddings1024 = buildEmbeddingsTable('embeddings_1024', 1024);

export type Embedding1536 = typeof embeddings1536.$inferSelect;
export type NewEmbedding1536 = typeof embeddings1536.$inferInsert;
export type Embedding1024 = typeof embeddings1024.$inferSelect;
export type NewEmbedding1024 = typeof embeddings1024.$inferInsert;
