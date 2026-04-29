-- =============================================================================
-- RLS Init — sets up tenant-scoped row-level security
-- =============================================================================
-- Apply AFTER Drizzle Kit migrations create the underlying tables.
-- Idempotent: safe to re-run.
--
-- Pattern:
--   1. Enable RLS on every tenant-scoped table
--   2. Create a policy enforcing tenant_id = current_setting('app.current_tenant_id')
--   3. App role uses these policies; superuser bypasses (for migrations + admin tools)
-- =============================================================================

-- Application role (replace with your actual role name in production)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role NOINHERIT LOGIN;
  END IF;
END $$;

-- Helper: enforces app.current_tenant_id is set; returns it as UUID
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION current_region()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_region', true), '')
$$;

-- =============================================================================
-- tenants — only super-admin reads cross-tenant; app sees its own row only
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_self_only ON tenants;
CREATE POLICY tenants_self_only ON tenants
  FOR ALL
  TO app_role
  USING (id = current_tenant_id() AND region::text = current_region())
  WITH CHECK (id = current_tenant_id() AND region::text = current_region());

-- =============================================================================
-- users — scoped to tenant
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- meetings — scoped to tenant
-- =============================================================================
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_tenant_isolation ON meetings;
CREATE POLICY meetings_tenant_isolation ON meetings
  FOR ALL
  TO app_role
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- Add new tables to this file as schemas grow.
-- Pattern: ALTER TABLE x ENABLE ROW LEVEL SECURITY; then policy on tenant_id.
-- =============================================================================
