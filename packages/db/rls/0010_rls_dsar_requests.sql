-- =============================================================================
-- RLS — dsar_requests (Story 14.1)
-- =============================================================================
-- Apply AFTER the create_dsar_requests migration. Idempotent.
-- Pattern matches packages/db/rls/0007_rls_feedback_thumbs.sql (strict
-- in-tenant). The DSAR worker runs inside `withJobContext` so the same
-- policy applies to it as to API reads/writes.
-- =============================================================================

ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dsar_requests_tenant_isolation ON dsar_requests;
CREATE POLICY dsar_requests_tenant_isolation ON dsar_requests
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
