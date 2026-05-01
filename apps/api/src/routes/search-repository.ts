/**
 * Repository seam for the search route (Story 7.2).
 *
 * Today: Postgres FTS over `meetings.title` + `speaker_turns.text` via
 * `to_tsvector('english', ...)` + `plainto_tsquery`. Module-output
 * summaries get the same FTS treatment when the column carries them.
 *
 * Tomorrow (Story 7.1): the indexer worker writes into
 * `embeddings_1536` / `embeddings_1024` and the search service moves to
 * a hybrid ranker that combines `ts_rank` with cosine similarity. The
 * `SearchRepository` interface is intentionally narrow so the swap is
 * one file.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { meetings, speakerTurns } from '@aisecretary/db/schema';
import { type SQL, and, desc, eq, sql } from 'drizzle-orm';

export interface SearchHit {
  meetingId: string;
  meetingTitle: string;
  turnId: string | null;
  speaker: string | null;
  spanStartMs: number | null;
  spanEndMs: number | null;
  snippet: string;
  rank: number;
  source: 'meeting-title' | 'transcript' | 'summary';
}

export interface SearchInput {
  tenantId: string;
  query: string;
  meetingId?: string;
  limit: number;
}

export interface SearchResult {
  hits: SearchHit[];
  totalCount: number;
}

export interface SearchRepository {
  search(input: SearchInput): Promise<SearchResult>;
}

export class DrizzleSearchRepository implements SearchRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async search(input: SearchInput): Promise<SearchResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const tsQuery = sql<string>`plainto_tsquery('english', ${input.query})`;

        // 1) Transcript hits — speaker_turns text + meeting metadata.
        const transcriptConditions: SQL[] = [
          eq(speakerTurns.tenantId, input.tenantId),
          sql`to_tsvector('english', ${speakerTurns.text}) @@ ${tsQuery}`,
        ];
        if (input.meetingId) {
          transcriptConditions.push(eq(speakerTurns.meetingId, input.meetingId));
        }
        const transcriptWhere = and(...transcriptConditions);

        const transcriptRows = await tx
          .select({
            meetingId: speakerTurns.meetingId,
            meetingTitle: meetings.title,
            turnId: speakerTurns.turnId,
            speaker: speakerTurns.speaker,
            spanStartMs: speakerTurns.spanStartMs,
            spanEndMs: speakerTurns.spanEndMs,
            snippet: sql<string>`ts_headline('english', ${speakerTurns.text}, ${tsQuery}, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=2,FragmentDelimiter= … ')`,
            rank: sql<number>`ts_rank(to_tsvector('english', ${speakerTurns.text}), ${tsQuery})`,
          })
          .from(speakerTurns)
          .innerJoin(meetings, eq(meetings.id, speakerTurns.meetingId))
          .where(transcriptWhere)
          .orderBy(desc(sql`ts_rank(to_tsvector('english', ${speakerTurns.text}), ${tsQuery})`))
          .limit(input.limit);

        // 2) Title hits — match the user query against meeting.title.
        const titleConditions: SQL[] = [
          eq(meetings.tenantId, input.tenantId),
          sql`to_tsvector('english', ${meetings.title}) @@ ${tsQuery}`,
        ];
        if (input.meetingId) {
          titleConditions.push(eq(meetings.id, input.meetingId));
        }
        const titleWhere = and(...titleConditions);

        const titleRows = await tx
          .select({
            meetingId: meetings.id,
            meetingTitle: meetings.title,
            snippet: sql<string>`ts_headline('english', ${meetings.title}, ${tsQuery}, 'StartSel=<mark>,StopSel=</mark>')`,
            rank: sql<number>`ts_rank(to_tsvector('english', ${meetings.title}), ${tsQuery})`,
          })
          .from(meetings)
          .where(titleWhere)
          .orderBy(desc(sql`ts_rank(to_tsvector('english', ${meetings.title}), ${tsQuery})`))
          .limit(input.limit);

        const hits: SearchHit[] = [
          ...titleRows.map((r) => ({
            meetingId: r.meetingId,
            meetingTitle: r.meetingTitle,
            turnId: null,
            speaker: null,
            spanStartMs: null,
            spanEndMs: null,
            snippet: r.snippet,
            rank: Number(r.rank),
            source: 'meeting-title' as const,
          })),
          ...transcriptRows.map((r) => ({
            meetingId: r.meetingId,
            meetingTitle: r.meetingTitle,
            turnId: r.turnId,
            speaker: r.speaker ?? null,
            spanStartMs: r.spanStartMs,
            spanEndMs: r.spanEndMs,
            snippet: r.snippet,
            rank: Number(r.rank),
            source: 'transcript' as const,
          })),
        ];
        // Sort the merged set by rank desc so the title hits and
        // transcript hits interleave properly.
        hits.sort((a, b) => b.rank - a.rank);
        const trimmed = hits.slice(0, input.limit);

        return {
          hits: trimmed,
          totalCount: hits.length,
        };
      },
    );
  }
}

/**
 * In-memory variant for tests. Substring + lowercase matching;
 * `rank` is computed as a simple match-count proxy. The wire shape
 * matches the Drizzle variant exactly so route-level assertions work
 * the same in both contexts.
 */
export interface InMemorySearchSeed extends Omit<SearchHit, 'rank' | 'snippet'> {
  /** Raw text (transcript) or title — used for substring matching. */
  text: string;
}

export class InMemorySearchRepository implements SearchRepository {
  public readonly rows: Array<InMemorySearchSeed & { tenantId: string }> = [];

  insert(tenantId: string, row: InMemorySearchSeed): void {
    this.rows.push({ ...row, tenantId });
  }

  async search(input: SearchInput): Promise<SearchResult> {
    const q = input.query.toLowerCase();
    const matches = this.rows
      .filter((r) => {
        if (r.tenantId !== input.tenantId) return false;
        if (input.meetingId && r.meetingId !== input.meetingId) return false;
        return r.text.toLowerCase().includes(q);
      })
      .map((r) => {
        const occurrences = (r.text.toLowerCase().match(new RegExp(escapeRegex(q), 'g')) ?? [])
          .length;
        const rank = occurrences > 0 ? Math.min(1, occurrences * 0.1) : 0;
        // Render the snippet with a single <mark> wrap around the first
        // case-insensitive occurrence of the query. Mirrors the
        // user-visible shape of `ts_headline` but without the multi-
        // fragment behavior.
        const idx = r.text.toLowerCase().indexOf(q);
        const snippet =
          idx === -1
            ? r.text.slice(0, 120)
            : `${r.text.slice(0, idx)}<mark>${r.text.slice(idx, idx + q.length)}</mark>${r.text.slice(idx + q.length)}`;
        return {
          meetingId: r.meetingId,
          meetingTitle: r.meetingTitle,
          turnId: r.turnId,
          speaker: r.speaker,
          spanStartMs: r.spanStartMs,
          spanEndMs: r.spanEndMs,
          snippet,
          rank,
          source: r.source,
        };
      });
    matches.sort((a, b) => b.rank - a.rank);
    return {
      hits: matches.slice(0, input.limit),
      totalCount: matches.length,
    };
  }
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
