/**
 * Vector retriever — Story 7.1 + 7.4 substrate.
 *
 * Replaces the search-backed retriever (Story 7.2 stub) with a
 * pgvector-backed one once Story 7.1's `embeddings_1024` /
 * `embeddings_1536` tables carry rows. Federation across surfaces
 * (transcripts / summaries / actions / analyses) happens via
 * `sourceKind` filtering — the indexer worker writes one row per
 * (chunk, sourceKind) so the retriever can union across kinds at
 * query time.
 *
 * This module mirrors `chat.ts`'s `ChatRetriever` shape so it's a
 * one-line swap inside `buildServer()`. It accepts an `embeddingProvider`
 * (the Story 7.1 contract) so the retriever computes the query vector
 * inline before the cosine-similarity query.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { embeddings1024, embeddings1536, meetings } from '@aisecretary/db/schema';
import type { CitationRef } from '@aisecretary/shared';
import { type SQL, and, eq, inArray, sql } from 'drizzle-orm';

import type { ChatRetriever } from './chat.js';

export interface QueryEmbeddingProvider {
  modelId: string;
  dimension: 1024 | 1536;
  embed(input: { text: string; tenantId: string }): Promise<number[]>;
}

export interface VectorRetrieverOptions {
  db: Db;
  region: Region;
  embeddingProvider: QueryEmbeddingProvider;
  /** Top-K chunks to fetch. Defaults to 8. */
  topK?: number;
  /**
   * Story 7.4 — source-kind federation. Defaults to ['transcript'];
   * pass ['transcript', 'summary', 'action-item'] to federate.
   */
  sourceKinds?: ReadonlyArray<'transcript' | 'summary' | 'action-item'>;
}

/**
 * Build a `ChatRetriever` that uses pgvector cosine similarity.
 * Production injects this into `chatRoutes` instead of
 * `buildSearchBackedRetriever`.
 */
export const buildVectorRetriever = (options: VectorRetrieverOptions): ChatRetriever => {
  const topK = options.topK ?? 8;
  const sourceKinds = options.sourceKinds ?? ['transcript'];
  // The two per-dimension tables share an identical column shape but
  // have different table types from Drizzle's perspective. Picking
  // one as the working type avoids the discriminated-union errors
  // when calling helpers like `inArray` against `table.sourceKind`.
  const table = (
    options.embeddingProvider.dimension === 1536 ? embeddings1536 : embeddings1024
  ) as typeof embeddings1536;

  return async ({ tenantId, query, meetingId }) => {
    const queryVector = await options.embeddingProvider.embed({
      text: query,
      tenantId,
    });

    return await withTenantContext(options.db, { tenantId, region: options.region }, async (tx) => {
      // Cosine distance via pgvector's `<=>` operator. Smaller is
      // closer; we ORDER BY distance ASC and LIMIT topK.
      const queryLiteral = `[${queryVector.join(',')}]`;
      const conditions: SQL[] = [
        eq(table.tenantId, tenantId),
        inArray(table.sourceKind, [...sourceKinds]),
      ];
      if (meetingId) {
        conditions.push(eq(table.meetingId, meetingId));
      }

      const rows = await tx
        .select({
          chunkKey: table.chunkKey,
          meetingId: table.meetingId,
          meetingTitle: meetings.title,
          sourceKind: table.sourceKind,
          sourceText: table.sourceText,
          distance: sql<number>`${table.embedding} <=> ${queryLiteral}::vector`,
        })
        .from(table)
        .innerJoin(meetings, eq(meetings.id, table.meetingId))
        .where(and(...conditions))
        .orderBy(sql`${table.embedding} <=> ${queryLiteral}::vector`)
        .limit(topK);

      // Convert distance → similarity (1 - cosine_distance) for the
      // retrievalConfidence shape expected by `chat.ts`. We take the
      // top hit's similarity as the overall confidence.
      const typedRows = rows as ReadonlyArray<{
        chunkKey: string;
        meetingId: string;
        meetingTitle: string;
        sourceKind: string;
        sourceText: string;
        distance: number;
      }>;
      const topSimilarity = typedRows[0] ? Math.max(0, 1 - Number(typedRows[0].distance)) : 0;
      const citations: CitationRef[] = [];
      const contextLines: string[] = [];
      for (const r of typedRows) {
        contextLines.push(`[${r.meetingTitle}] ${r.sourceText}`);
        // Parse the chunkKey (`turnId:chunkIndex` per Story 7.1
        // indexer) so we can hand the citation back in the shape
        // CitationChip expects. The indexer carries spanStartMs +
        // spanEndMs in a follow-up — for today, the citation
        // resolves to the parent turn at offset 0.
        const [turnId] = r.chunkKey.split(':');
        if (turnId) {
          citations.push({
            meetingId: r.meetingId,
            turnId,
            spanStartMs: 0,
            spanEndMs: 0,
          });
        }
      }
      return {
        citations,
        context: contextLines.join('\n\n'),
        retrievalConfidence: topSimilarity,
      };
    });
  };
};
