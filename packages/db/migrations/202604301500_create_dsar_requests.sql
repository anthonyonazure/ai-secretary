-- =============================================================================
-- Story 14.1 — `dsar_requests` table
-- Captures self-service DSAR (Data Subject Access Request) lifecycle.
-- See packages/db/src/schema/dsar-requests.ts.
--
-- Lifecycle (FSM):
--   queued → processing → ready    (success path)
--                       ↘ failed   (worker exception)
--                         expired  (7d TTL elapsed)
--
-- The DSAR worker (`apps/workers/src/handlers/dsar-export.ts`) walks
-- the erasure-cascade registry to assemble each requester's data into
-- a zip, uploads to S3, mints a 7-day presigned-GET URL, and dispatches
-- `kind: 'dsar-ready'` email via packages/notifications.
--
-- RLS policies live in packages/db/rls/0010_rls_dsar_requests.sql.
-- Strict in-tenant pattern (same as speaker_turns / feedback_thumbs).
-- =============================================================================

CREATE TABLE dsar_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired')),
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  storage_key TEXT,
  size_bytes BIGINT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Hot lookup — list one user's DSAR requests, newest first.
CREATE INDEX idx_dsar_requests_tenant_user ON dsar_requests (tenant_id, user_id);

-- Idempotent-insert guard.
CREATE UNIQUE INDEX uniq_dsar_requests_tenant_id_user_id_created_at
  ON dsar_requests (tenant_id, user_id, created_at);
