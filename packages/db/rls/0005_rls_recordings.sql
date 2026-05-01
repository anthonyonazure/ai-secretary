-- =============================================================================
-- RLS — recordings (Story 2.1)
-- =============================================================================
-- Apply AFTER the create_recordings migration. Idempotent.
-- Pattern matches packages/db/rls/0002_rls_notifications.sql.
-- =============================================================================

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recordings_tenant_isolation ON recordings;
CREATE POLICY recordings_tenant_isolation ON recordings
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
