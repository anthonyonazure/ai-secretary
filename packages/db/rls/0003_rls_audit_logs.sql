-- =============================================================================
-- RLS — audit_logs (Story 1.4)
-- Apply AFTER the create_audit_logs migration. Idempotent.
--
-- Strict in-tenant-only policy. Cross-tenant audit writes are NOT
-- permitted — `arch-addendums.md` § 8 / ADR-0006 explicitly rejects
-- service-role bypass and instead routes cross-org-share notifications
-- to the receiver's own `inbound_shares` table.
-- =============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
