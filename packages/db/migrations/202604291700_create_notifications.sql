-- =============================================================================
-- Story 1.10 — `packages/notifications` foundation
-- Creates the `notifications` (append-only dispatch log) and
-- `user_preferences` (per-channel + per-kind opt-out) tables.
-- See packages/notifications/src/types.ts and arch-addendums § 5.
-- =============================================================================

-- Enums --------------------------------------------------------------

CREATE TYPE notification_channel AS ENUM ('push', 'email');

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'suppressed');

-- notifications ------------------------------------------------------

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  channel notification_channel NOT NULL,
  kind TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot-path index for the 5-minute dedup-window lookup.
CREATE INDEX idx_notifications_dedup
  ON notifications (tenant_id, recipient, kind, dedup_key, created_at);

-- General tenant-scoped pagination index.
CREATE INDEX idx_notifications_tenant_id_created_at
  ON notifications (tenant_id, created_at);

-- user_preferences ---------------------------------------------------

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channel notification_channel NOT NULL,
  kind TEXT NOT NULL,
  opted_out TEXT NOT NULL DEFAULT 'true',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (tenant, user, channel, kind).
CREATE UNIQUE INDEX idx_user_preferences_user_channel_kind
  ON user_preferences (tenant_id, user_id, channel, kind);

-- RLS policies live in packages/db/rls/0002_rls_notifications.sql.
