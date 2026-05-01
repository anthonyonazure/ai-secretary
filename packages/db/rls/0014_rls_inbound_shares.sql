-- Story 8.4 / ADR-0006 — strict in-tenant RLS for receiving-tenant inbound shares.
-- Append-only from the app role (mirrors audit_logs discipline). Status
-- mutations land via a SECURITY INVOKER stored proc that runs under tenant
-- context and only flips status fields (lands in Story 12.x admin work).

ALTER TABLE inbound_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbound_shares_isolation ON inbound_shares
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

REVOKE UPDATE, DELETE ON inbound_shares FROM PUBLIC;
