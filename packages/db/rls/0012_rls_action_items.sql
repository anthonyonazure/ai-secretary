-- =============================================================================
-- RLS — action_items (Story 3.3)
-- =============================================================================
-- Apply AFTER the create_action_items migration. Idempotent.
-- Pattern matches packages/db/rls/0006_rls_speaker_turns.sql (strict in-tenant).
-- =============================================================================

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_items_tenant_isolation ON action_items;
CREATE POLICY action_items_tenant_isolation ON action_items
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
