-- =============================================================================
-- Story 3.5 (absorbing Story 2.4) — `speaker_turns` table
-- Diarized transcript segments anchored to a meeting; substrate for the
-- `CitationChip` V2 + `TranscriptSeekPlayer` deep-link contract
-- `(meetingId, turnId)`.
--
-- See packages/db/src/schema/speaker-turns.ts for the Drizzle table +
-- packages/db/src/lib/speaker-turn-id.ts for the stable `turn_id` hash
-- recipe (sha256(meetingId || sequence || speaker || spanStartMs || text)
-- truncated to 16 hex chars).
--
-- Stability commitment: once a row is written, its turn_id is never
-- mutated. Re-runs of transcription that change boundaries write NEW
-- rows; existing citations keep resolving.
-- =============================================================================

CREATE TABLE speaker_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  -- Stable hash ID — citation deep-link key per `(meetingId, turnId)`.
  -- 16 lowercase hex chars (64 bits). Recipe lives in lib/speaker-turn-id.ts.
  turn_id TEXT NOT NULL,
  speaker TEXT,
  span_start_ms INTEGER NOT NULL,
  span_end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  -- 0.000–1.000; null while streaming.
  confidence NUMERIC(4, 3),
  sequence INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Citation deep-link uniqueness: `(meetingId, turnId)` resolves to ≤1 row.
CREATE UNIQUE INDEX uq_speaker_turns_meeting_id_turn_id
  ON speaker_turns (meeting_id, turn_id);

-- Hot-path read: render transcript in order for a meeting.
CREATE INDEX idx_speaker_turns_meeting_id_sequence
  ON speaker_turns (meeting_id, sequence);

-- RLS policies live in packages/db/rls/0006_rls_speaker_turns.sql.
