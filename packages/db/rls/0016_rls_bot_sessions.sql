-- =============================================================================
-- RLS — bot_sessions (Story 9.x)
-- =============================================================================
-- Apply AFTER the create_bot_sessions migration. Idempotent.
-- Pattern matches packages/db/rls/0005_rls_recordings.sql.
--
-- Workers run with a role that bypasses RLS (BYPASSRLS) so the
-- `bot-watchdog` cross-tenant scan in
-- apps/workers/src/handlers/bot-watchdog-reader.ts works without
-- per-tenant fan-out. The application path (apps/api + apps/bot)
-- always sets `app.current_tenant_id` first via withTenantContext.
-- =============================================================================

ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bot_sessions_tenant_isolation ON bot_sessions;
CREATE POLICY bot_sessions_tenant_isolation ON bot_sessions
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
