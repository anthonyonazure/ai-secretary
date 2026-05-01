-- =============================================================================
-- Story 1.5d — `tenant_invites` table
-- Captures pending email invitations for new org members.
-- See packages/db/src/schema/tenant-invites.ts.
--
-- Tokens are stored hashed (sha256 hex). The plaintext token only ever
-- exists inside the email + accept-URL; never logged, never persisted.
--
-- Lifecycle:
--   - One open invite per (tenantId, email).
--   - expires_at default 7 days at API, override up to 30 days.
--   - acceptedAt / acceptedByUserId populate on successful accept.
--   - revokedAt / revokedByUserId populate when an admin revokes.
--
-- RLS policies live in packages/db/rls/0009_rls_tenant_invites.sql.
-- =============================================================================

CREATE TABLE tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'org_member',
  -- Single-use opaque token, sha256(plaintext) hex stored. Plaintext
  -- never persists; lookup runs `WHERE token_hash = sha256(supplied)`.
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Token uniqueness — every token resolves to ≤1 row.
CREATE UNIQUE INDEX uq_tenant_invites_token_hash ON tenant_invites (token_hash);

-- One open invite per email per tenant.
CREATE UNIQUE INDEX uniq_tenant_invites_tenant_id_email
  ON tenant_invites (tenant_id, email);

-- Hot-path read: admin lists invites for a tenant.
CREATE INDEX idx_tenant_invites_tenant_id_email
  ON tenant_invites (tenant_id, email);

-- Hot-path read: public accept lookups by token_hash (RLS bypass policy).
CREATE INDEX idx_tenant_invites_token_hash
  ON tenant_invites (token_hash);
