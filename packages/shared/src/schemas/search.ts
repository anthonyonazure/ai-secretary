/**
 * Search wire schemas — Story 7.2 (full-text search; semantic-search
 * hybrid lands when Story 7.1 ships the per-dimension embeddings
 * tables).
 *
 * Query shape:
 *   GET /search?q=<query>&limit=20&meetingId=<uuid>
 *
 * Response shape: ranked snippets that deep-link to transcript turns
 * via the `(meetingId, turnId)` citation contract used everywhere in
 * the app — same contract `CitationChip` consumes.
 */

import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  /** Optional filter — search inside one meeting. */
  meetingId: z.string().uuid().optional(),
  /** Cap result count. */
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResultSnippetSchema = z.object({
  /** Deep-link target. */
  meetingId: z.string().uuid(),
  meetingTitle: z.string(),
  /** Speaker-turn id (citation key); null when the hit is on the meeting
   *  title itself rather than a transcript span. */
  turnId: z.string().nullable(),
  speaker: z.string().nullable(),
  spanStartMs: z.number().int().nonnegative().nullable(),
  spanEndMs: z.number().int().nonnegative().nullable(),
  /** Highlighted snippet — `<mark>matched terms</mark>` markup wrapped. */
  snippet: z.string(),
  /** ts_rank score; higher is better. Useful for clients that want to
   *  show a confidence bar. */
  rank: z.number(),
  /** Hit source — used by clients to render a subtle badge ("title" /
   *  "transcript" / "summary"). */
  source: z.enum(['meeting-title', 'transcript', 'summary']),
});
export type SearchResultSnippet = z.infer<typeof searchResultSnippetSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  items: z.array(searchResultSnippetSchema),
  totalCount: z.number().int().min(0),
  /** Latency ms — surfaced for the p95 < 2s SLO in Story 7.2. */
  durationMs: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
