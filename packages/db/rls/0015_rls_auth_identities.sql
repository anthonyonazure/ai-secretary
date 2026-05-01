-- Story 1.5b — RLS for auth_identities.
-- Identities belong to users; tenant scoping comes through the user join.
-- Direct policy: only the owning user (or a super_admin platform query)
-- may read/write. App-role inserts under tenant context resolve the user
-- via `current_setting('app.current_user_id', true)::uuid`.

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_identities_owner ON auth_identities
  USING (
    user_id IN (
      SELECT id FROM users WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );
