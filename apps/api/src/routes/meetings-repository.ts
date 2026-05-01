/**
 * Repository seam for the meetings routes (Story 2.1 follow-up).
 *
 * The meetings surface is read-only at this slice — the routes need:
 *   - speaker-turns for a meeting (transcript surface)
 *   - the latest 'completed' recording for a meeting (playback URL)
 *
 * Mirrors `recordings-repository.ts` — production wires Drizzle against
 * the live tables; tests inject the `InMemoryMeetingsRepository` so the
 * route handler stays exercisable without a Postgres process.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { meetings, recordings, speakerTurns } from '@aisecretary/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

export interface SpeakerTurnRow {
  /** Stable hash deep-link key — NOT the row UUID. See speaker-turns.ts. */
  turnId: string;
  speaker: string | null;
  spanStartMs: number;
  spanEndMs: number;
  text: string;
  /** numeric(4,3) → number | null. */
  confidence: number | null;
  sequence: number;
}

export interface MeetingRecordingRow {
  id: string;
  storageKey: string;
  contentType: string;
}

export interface MeetingSummaryRow {
  id: string;
  title: string;
  source: 'mobile_recording' | 'web_recording' | 'upload' | 'zoom_bot' | 'teams_bot';
  status:
    | 'pending_upload'
    | 'uploaded'
    | 'transcribing'
    | 'transcribed'
    | 'summarizing'
    | 'summarized'
    | 'analyzing'
    | 'analyzed'
    | 'failed';
  durationSeconds: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface ListMeetingsInput {
  tenantId: string;
  /** Page size; capped server-side. */
  limit: number;
  /** Opaque cursor token (base64 of `createdAt|id`); null = first page. */
  cursor: string | null;
}

export interface ListMeetingsResult {
  items: MeetingSummaryRow[];
  nextCursor: string | null;
  totalCount: number;
}

export interface MeetingsRepository {
  /** Returns rows ordered by `sequence` ASC. Empty array when none exist. */
  findSpeakerTurnsByMeetingId(meetingId: string, tenantId: string): Promise<SpeakerTurnRow[]>;
  /**
   * Returns the most recent recording with status='completed' for the
   * meeting, or null when no playable recording exists yet. Used to
   * presign the meeting → playback URL chain without exposing
   * `recordingId` in the URL contract.
   */
  findLatestCompletedRecordingByMeetingId(
    meetingId: string,
    tenantId: string,
  ): Promise<MeetingRecordingRow | null>;
  /**
   * Cursor-paginated tenant-scoped meetings list. Sorted by createdAt
   * DESC then id DESC for tie-break. Story 1.7 (inbox empty-state gate).
   */
  listMeetings(input: ListMeetingsInput): Promise<ListMeetingsResult>;
}

const CURSOR_DELIM = '|';

/** Decode a base64 cursor `createdAtIso|id` → `{ createdAt, id }` or null. */
const decodeCursor = (cursor: string | null): { createdAt: Date; id: string } | null => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [iso, id] = raw.split(CURSOR_DELIM);
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

/** Encode `{ createdAt, id }` → base64 cursor `createdAtIso|id`. */
const encodeCursor = (createdAt: Date, id: string): string => {
  const raw = `${createdAt.toISOString()}${CURSOR_DELIM}${id}`;
  return Buffer.from(raw, 'utf8').toString('base64');
};

export const __cursorCodec = { decode: decodeCursor, encode: encodeCursor };

export class DrizzleMeetingsRepository implements MeetingsRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async findSpeakerTurnsByMeetingId(
    meetingId: string,
    tenantId: string,
  ): Promise<SpeakerTurnRow[]> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(speakerTurns)
        .where(and(eq(speakerTurns.meetingId, meetingId), eq(speakerTurns.tenantId, tenantId)))
        .orderBy(asc(speakerTurns.sequence));
      return rows.map((r) => ({
        turnId: r.turnId,
        speaker: r.speaker ?? null,
        spanStartMs: r.spanStartMs,
        spanEndMs: r.spanEndMs,
        text: r.text,
        // `numeric(4,3)` is returned by postgres-js as a string; coerce
        // to number for the wire schema.
        confidence: r.confidence === null ? null : Number(r.confidence),
        sequence: r.sequence,
      }));
    });
  }

  async findLatestCompletedRecordingByMeetingId(
    meetingId: string,
    tenantId: string,
  ): Promise<MeetingRecordingRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select({
          id: recordings.id,
          storageKey: recordings.storageKey,
          contentType: recordings.contentType,
          transcribedAt: recordings.transcribedAt,
        })
        .from(recordings)
        .where(
          and(
            eq(recordings.meetingId, meetingId),
            eq(recordings.tenantId, tenantId),
            eq(recordings.status, 'completed'),
          ),
        )
        // Most-recently-transcribed completed recording wins.
        .orderBy(desc(recordings.transcribedAt))
        .limit(1);
      const row = rows[0];
      return row ? { id: row.id, storageKey: row.storageKey, contentType: row.contentType } : null;
    });
  }

  async listMeetings(input: ListMeetingsInput): Promise<ListMeetingsResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const cursor = decodeCursor(input.cursor);
        const baseCondition = eq(meetings.tenantId, input.tenantId);
        const whereClause = cursor
          ? and(
              baseCondition,
              // Strict-less-than on (createdAt, id) for a stable cursor
              // when two meetings share a millisecond.
              sql`(${meetings.createdAt}, ${meetings.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
            )
          : baseCondition;

        const rows = await tx
          .select({
            id: meetings.id,
            title: meetings.title,
            source: meetings.source,
            status: meetings.status,
            durationSeconds: meetings.durationSeconds,
            startedAt: meetings.startedAt,
            endedAt: meetings.endedAt,
            createdAt: meetings.createdAt,
          })
          .from(meetings)
          .where(whereClause)
          .orderBy(desc(meetings.createdAt), desc(meetings.id))
          // Fetch one extra so we can detect whether a next page exists.
          .limit(input.limit + 1);

        const totalRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(meetings)
          .where(eq(meetings.tenantId, input.tenantId));
        const totalCount = Number(totalRows[0]?.count ?? 0);

        const hasMore = rows.length > input.limit;
        const trimmed = hasMore ? rows.slice(0, input.limit) : rows;
        const last = trimmed[trimmed.length - 1];
        const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

        return {
          items: trimmed.map((r) => ({
            id: r.id,
            title: r.title,
            source: r.source,
            status: r.status,
            durationSeconds: r.durationSeconds,
            startedAt: r.startedAt,
            endedAt: r.endedAt,
            createdAt: r.createdAt,
          })),
          nextCursor,
          totalCount,
        };
      },
    );
  }
}

/**
 * In-memory repository for tests. Stores rows under a `(tenantId,
 * meetingId)` partition so cross-tenant reads always come back empty.
 */
export class InMemoryMeetingsRepository implements MeetingsRepository {
  public readonly turns = new Map<string, SpeakerTurnRow[]>();
  public readonly recordings = new Map<string, MeetingRecordingRow[]>();
  public readonly meetings = new Map<string, MeetingSummaryRow[]>();

  private static key(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }

  setSpeakerTurns(tenantId: string, meetingId: string, rows: SpeakerTurnRow[]): void {
    this.turns.set(InMemoryMeetingsRepository.key(tenantId, meetingId), rows);
  }

  setRecordings(tenantId: string, meetingId: string, rows: MeetingRecordingRow[]): void {
    this.recordings.set(InMemoryMeetingsRepository.key(tenantId, meetingId), rows);
  }

  setMeetings(tenantId: string, rows: MeetingSummaryRow[]): void {
    this.meetings.set(tenantId, rows);
  }

  async findSpeakerTurnsByMeetingId(
    meetingId: string,
    tenantId: string,
  ): Promise<SpeakerTurnRow[]> {
    const list = this.turns.get(InMemoryMeetingsRepository.key(tenantId, meetingId)) ?? [];
    // Sort defensively — callers expect sequence-ASC order regardless of
    // the order they pushed rows in.
    return [...list].sort((a, b) => a.sequence - b.sequence);
  }

  async findLatestCompletedRecordingByMeetingId(
    meetingId: string,
    tenantId: string,
  ): Promise<MeetingRecordingRow | null> {
    const list = this.recordings.get(InMemoryMeetingsRepository.key(tenantId, meetingId)) ?? [];
    return list[0] ?? null;
  }

  async listMeetings(input: ListMeetingsInput): Promise<ListMeetingsResult> {
    const all = this.meetings.get(input.tenantId) ?? [];
    // Stable sort: createdAt DESC, id DESC for tie-break.
    const sorted = [...all].sort((a, b) => {
      const t = b.createdAt.getTime() - a.createdAt.getTime();
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });
    const cursor = decodeCursor(input.cursor);
    const filtered = cursor
      ? sorted.filter((m) => {
          const ct = m.createdAt.getTime();
          const cct = cursor.createdAt.getTime();
          if (ct < cct) return true;
          if (ct === cct && m.id.localeCompare(cursor.id) < 0) return true;
          return false;
        })
      : sorted;
    const slice = filtered.slice(0, input.limit + 1);
    const hasMore = slice.length > input.limit;
    const trimmed = hasMore ? slice.slice(0, input.limit) : slice;
    const last = trimmed[trimmed.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      items: trimmed,
      nextCursor,
      totalCount: sorted.length,
    };
  }
}
