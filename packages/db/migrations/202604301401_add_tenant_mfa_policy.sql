-- =============================================================================
-- Story 1.5c — org-wide MFA enforcement flag on tenants.
-- See packages/db/src/schema/tenants.ts.
--
-- When `tenants.mfa_required = true`, the /api/v1/auth/login endpoint
-- returns a `kind: 'mfa-required'` challenge for every user in the
-- tenant, even when the user row itself has `is_mfa_enabled = false` —
-- the response carries `enrollmentRequired: true` so the client routes
-- the user through enrollment BEFORE the session is issued.
-- =============================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT false;
