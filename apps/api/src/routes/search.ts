/**
 * Search route — Story 7.2 (FR28).
 *
 * Mount path: `/api/v1/search` (set by `buildServer()` via prefix).
 *
 *   GET /?q=<query>&meetingId=<uuid>&limit=20
 *
 * Today: full-text search via Postgres tsvector. Story 7.1 will add
 * embeddings + a hybrid ranker; the wire shape stays identical.
 *
 * Read-only — `skipAudit: true`. Tenant scoping via RLS in the repo.
 */

import {
  type SearchResponse,
  type SearchResultSnippet,
  searchQuerySchema,
  searchResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';
import type { SearchHit, SearchRepository } from './search-repository.js';

export interface SearchRoutesOptions {
  repository: SearchRepository;
}

const requireAuth = (request: FastifyRequest): { tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { tenantId: request.tenantId };
};

const toWire = (hit: SearchHit): SearchResultSnippet => ({
  meetingId: hit.meetingId,
  meetingTitle: hit.meetingTitle,
  turnId: hit.turnId,
  speaker: hit.speaker,
  spanStartMs: hit.spanStartMs,
  spanEndMs: hit.spanEndMs,
  snippet: hit.snippet,
  rank: hit.rank,
  source: hit.source,
});

export const searchRoutes = (options: SearchRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const parsed = searchQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid search query.');
        }
        const { q, meetingId, limit } = parsed.data;

        const start = Date.now();
        const result = await options.repository.search({
          tenantId,
          query: q,
          ...(meetingId ? { meetingId } : {}),
          limit,
        });
        const durationMs = Date.now() - start;

        const body: SearchResponse = {
          query: q,
          items: result.hits.map(toWire),
          totalCount: result.totalCount,
          durationMs,
        };
        return reply.status(200).send(searchResponseSchema.parse(body));
      },
    );
  };
};
