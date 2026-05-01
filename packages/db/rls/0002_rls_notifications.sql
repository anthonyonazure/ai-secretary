-- =============================================================================
-- RLS — notifications + user_preferences (Story 1.10)
-- =============================================================================
-- Apply AFTER the create_notifications migration. Idempotent.
-- =============================================================================

-- =============================================================================
-- notifications — scoped to tenant
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;
CREATE POLICY notifications_tenant_isolation ON notifications
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- user_preferences — scoped to tenant
-- =============================================================================
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_tenant_isolation ON user_preferences;
CREATE POLICY user_preferences_tenant_isolation ON user_preferences
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
