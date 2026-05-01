import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';

/**
 * `speaker_turns` — diarized transcript segments anchored to a meeting.
 *
 * Story 2.4 (absorbed into Story 3.5) — the deep-link substrate for
 * `CitationChip` V2 + `TranscriptSeekPlayer`. The citation contract is
 * `(meetingId, turnId)`; `turn_id` is a stable hash (see
 * `lib/speaker-turn-id.ts`), NOT the row UUID, so analysis workers can
 * compute citations without round-tripping the database.
 *
 * Hash recipe (mirrored in `lib/speaker-turn-id.ts`):
 *   turn_id = sha256(meetingId || sequence || speaker || spanStartMs || text).slice(0, 16)
 *
 * Stability commitment: once a row is written, its `turn_id` is never
 * mutated. Re-runs of transcription that change boundaries write NEW
 * rows with NEW `turn_id`s rather than updating in place — existing
 * citations keep resolving against historical turns.
 *
 * Tenant-scoped (RLS). RLS policies live in
 * `packages/db/rls/0006_rls_speaker_turns.sql`.
 */
export const speakerTurns = pgTable(
  'speaker_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    /**
     * Stable hash ID — citation deep-link key per `(meetingId, turnId)`.
     * Computed via `computeTurnId` in `lib/speaker-turn-id.ts`. UNIQUE
     * within a meeting; not globally unique.
     */
    turnId: text('turn_id').notNull(),
    /** Diarized speaker label or null when diarization is unavailable. */
    speaker: text('speaker'),
    spanStartMs: integer('span_start_ms').notNull(),
    spanEndMs: integer('span_end_ms').notNull(),
    text: text('text').notNull(),
    /** Confidence 0.000–1.000 (numeric(4,3)); null while streaming. */
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    /** Ordering within the meeting — primary read-path sort key. */
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Uniqueness of `(meetingId, turnId)` — citation deep-link contract. */
    uqSpeakerTurnsMeetingTurn: uniqueIndex('uq_speaker_turns_meeting_id_turn_id').on(
      t.meetingId,
      t.turnId,
    ),
    /** Hot-path read: render transcript in order for a meeting. */
    idxSpeakerTurnsMeetingSeq: index('idx_speaker_turns_meeting_id_sequence').on(
      t.meetingId,
      t.sequence,
    ),
  }),
);

export type SpeakerTurn = typeof speakerTurns.$inferSelect;
export type NewSpeakerTurn = typeof speakerTurns.$inferInsert;
