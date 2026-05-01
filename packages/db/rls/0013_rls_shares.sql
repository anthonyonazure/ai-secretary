-- Story 8.1 — strict in-tenant RLS for sender-side shares.

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY shares_isolation ON shares
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
