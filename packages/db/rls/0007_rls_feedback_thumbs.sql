-- =============================================================================
-- RLS — feedback_thumbs (Story 1.7)
-- =============================================================================
-- Apply AFTER the create_feedback_thumbs migration. Idempotent.
-- Pattern matches packages/db/rls/0006_rls_speaker_turns.sql (strict in-tenant).
-- =============================================================================

ALTER TABLE feedback_thumbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_thumbs_tenant_isolation ON feedback_thumbs;
CREATE POLICY feedback_thumbs_tenant_isolation ON feedback_thumbs
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
