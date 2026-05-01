-- =============================================================================
-- RLS — tenant_invites (Story 1.5d)
-- =============================================================================
-- Apply AFTER the create_tenant_invites migration. Idempotent.
--
-- Two policies on this table:
--
--   1. tenant_invites_tenant_isolation — strict in-tenant pattern. Same
--      shape as packages/db/rls/0006_rls_speaker_turns.sql. Used by the
--      authenticated admin routes (POST/GET/DELETE under
--      /api/v1/tenants/:tenantId/invites). Enforces
--      `tenant_id = current_tenant_id()`.
--
--   2. tenant_invites_bypass_for_token — opt-in escape hatch for the
--      UNAUTHENTICATED public accept-invite flow:
--
--        GET  /api/v1/invites/:token         (lookup metadata)
--        POST /api/v1/invites/:token/accept  (consume + create user)
--
--      These run BEFORE tenant-context resolves a tenant id (the
--      recipient has no session yet). The repo opens a transaction,
--      sets `app.invite_token_lookup = 'allow'`, and queries by
--      `token_hash`. The bypass policy permits SELECT only when this
--      setting is in 'allow' mode AND the lookup constrains by
--      `token_hash`. The setting is auto-cleared at end-of-tx.
--
-- WHY a setting-gated bypass and not a separate role:
--   Roles propagate through the connection pool and are difficult to
--   reason about; a per-transaction setting is scoped to the exact
--   query that needs it. The repo wraps `findByTokenHash` and
--   `markAccepted` in a transaction that sets/unsets the flag
--   explicitly. RLS reads `current_setting('app.invite_token_lookup',
--   true)` — the second-arg `true` returns NULL when unset (instead of
--   raising), so the policy stays closed by default.
--
--   Updates that mutate state (accept consume, admin revoke) still
--   require the strict in-tenant policy via `WITH CHECK`. The bypass
--   only relaxes SELECT.
-- =============================================================================

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;

-- Strict in-tenant — admin reads/writes their own tenant's invites.
DROP POLICY IF EXISTS tenant_invites_tenant_isolation ON tenant_invites;
CREATE POLICY tenant_invites_tenant_isolation ON tenant_invites
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Opt-in bypass for the unauthenticated accept-invite SELECT path.
-- Only permits SELECT when `app.invite_token_lookup = 'allow'` is set
-- on the current transaction. The UPDATE that marks the invite
-- accepted runs separately under the strict isolation policy after
-- the new user row has been created (which establishes the tenant
-- context).
DROP POLICY IF EXISTS tenant_invites_bypass_for_token ON tenant_invites;
CREATE POLICY tenant_invites_bypass_for_token ON tenant_invites
  FOR SELECT
  TO app_role
  USING (current_setting('app.invite_token_lookup', true) = 'allow');
