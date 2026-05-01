-- =============================================================================
-- RLS — consents (Story 4.3)
-- =============================================================================
-- Apply AFTER the create_consents migration. Idempotent.
-- Pattern matches packages/db/rls/0002_rls_notifications.sql.
-- =============================================================================

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consents_tenant_isolation ON consents;
CREATE POLICY consents_tenant_isolation ON consents
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
