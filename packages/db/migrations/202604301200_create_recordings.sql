-- =============================================================================
-- Story 2.1 — recordings table
-- Tracks the multipart upload + transcription lifecycle for one capture cycle.
-- See packages/db/src/schema/recordings.ts.
-- =============================================================================

-- Enums --------------------------------------------------------------

CREATE TYPE recording_status AS ENUM (
  'uploading',
  'uploaded',
  'transcribing',
  'completed',
  'failed'
);

-- recordings ---------------------------------------------------------

CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT,
  status recording_status NOT NULL DEFAULT 'uploading',
  s3_upload_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_at TIMESTAMPTZ,
  transcribed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage object key uniqueness — same key cannot map to two recordings.
CREATE UNIQUE INDEX uniq_recordings_storage_key
  ON recordings (storage_key);

-- Tenant-scoped pagination index.
CREATE INDEX idx_recordings_tenant_id_created_at
  ON recordings (tenant_id, created_at);

-- Per-meeting lookup (recordings attached to a meeting).
CREATE INDEX idx_recordings_meeting_id
  ON recordings (meeting_id);

-- RLS policies live in packages/db/rls/0005_rls_recordings.sql.
