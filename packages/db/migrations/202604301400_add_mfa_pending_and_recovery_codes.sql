-- =============================================================================
-- Story 1.5c — extend `users` with MFA enrollment-pending flag + recovery
-- code hashes.
-- See packages/db/src/schema/users.ts.
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_pending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_code_hashes TEXT[] NOT NULL DEFAULT '{}';

-- No new RLS policy needed: existing `users_tenant_isolation` already
-- covers the new columns since they live on the same row.
