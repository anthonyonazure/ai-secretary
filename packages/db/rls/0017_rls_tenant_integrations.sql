-- =============================================================================
-- RLS — tenant_integrations (Story 15.x / ADR-0003)
-- =============================================================================
-- Apply AFTER the create_tenant_integrations migration. Idempotent.
--
-- Workers (BYPASSRLS) read across tenants for the `crm.push` queue
-- handler — same convention as recordings / bot_sessions watchdogs.
-- The application path (apps/api) always sets `app.current_tenant_id`
-- first via withTenantContext.
-- =============================================================================

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_integrations_isolation ON tenant_integrations;
CREATE POLICY tenant_integrations_isolation ON tenant_integrations
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
