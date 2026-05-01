-- =============================================================================
-- Story 1.4 — `audit_logs` table (append-only)
-- The `audit-logger` plugin in apps/api is the only sanctioned writer.
-- See apps/api/src/lib/audit-types.ts for the canonical action union and
-- apps/api/src/plugins/audit-logger.ts for the plugin contract.
-- =============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT NOT NULL,
  region TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-scoped pagination index — primary read path.
CREATE INDEX idx_audit_logs_tenant_id_created_at
  ON audit_logs (tenant_id, created_at);

-- Filtered-by-action read path (admin + compliance views).
CREATE INDEX idx_audit_logs_tenant_id_action
  ON audit_logs (tenant_id, action);

-- Resource-pivoted read path (e.g. "all events for meeting X").
CREATE INDEX idx_audit_logs_tenant_id_resource
  ON audit_logs (tenant_id, resource_type, resource_id);

-- =============================================================================
-- Append-only enforcement at the SQL level.
-- The application role gets SELECT + INSERT only; UPDATE + DELETE go to
-- migrations / superuser only. This is the architectural invariant from
-- docs/architecture.md § Audit log + § Schema invariants.
-- =============================================================================
GRANT SELECT, INSERT ON audit_logs TO app_role;
REVOKE UPDATE, DELETE ON audit_logs FROM app_role;

-- RLS policies live in packages/db/rls/0003_rls_audit_logs.sql.
