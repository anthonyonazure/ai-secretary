-- =============================================================================
-- RLS — speaker_turns (Story 3.5 / absorbed Story 2.4)
-- =============================================================================
-- Apply AFTER the create_speaker_turns migration. Idempotent.
-- Pattern matches packages/db/rls/0004_rls_consents.sql (strict in-tenant).
-- =============================================================================

ALTER TABLE speaker_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS speaker_turns_tenant_isolation ON speaker_turns;
CREATE POLICY speaker_turns_tenant_isolation ON speaker_turns
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
