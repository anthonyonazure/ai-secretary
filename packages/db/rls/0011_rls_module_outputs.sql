-- =============================================================================
-- RLS — module_outputs (Story 3.2)
-- =============================================================================
-- Apply AFTER the create_module_outputs migration. Idempotent.
-- Pattern matches packages/db/rls/0006_rls_speaker_turns.sql (strict in-tenant).
-- =============================================================================

ALTER TABLE module_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_outputs_tenant_isolation ON module_outputs;
CREATE POLICY module_outputs_tenant_isolation ON module_outputs
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
