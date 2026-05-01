-- =============================================================================
-- Story 1.7 — `feedback_thumbs` table
-- Captures per-meeting thumbs-up/down responses for the first-three-receipt
-- polish prompt (and any general-purpose feedback that follows).
-- See packages/db/src/schema/feedback-thumbs.ts.
--
-- Single response per user per meeting (UNIQUE) — repeat clicks are
-- de-duped at the API surface (409 on duplicate).
-- =============================================================================

CREATE TABLE feedback_thumbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('up', 'down')),
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One response per user per meeting.
CREATE UNIQUE INDEX uniq_feedback_thumbs_user_id_meeting_id
  ON feedback_thumbs (user_id, meeting_id);

-- Tenant-scoped pagination index.
CREATE INDEX idx_feedback_thumbs_tenant_id_created_at
  ON feedback_thumbs (tenant_id, created_at);

-- RLS policies live in packages/db/rls/0007_rls_feedback_thumbs.sql.
