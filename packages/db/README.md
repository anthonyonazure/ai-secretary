# @ai-secretary/db

Drizzle ORM schema, migrations, and tenant-scoped row-level security for the AI Secretary platform.

## Architecture rules

- Every tenant-scoped table has `tenant_id UUID NOT NULL` with FK to `tenants` and an RLS policy enforcing `tenant_id = current_setting('app.current_tenant_id')::uuid`
- All DB access goes through `withTenantContext()` — fail-closed if tenantId missing
- Migrations are forward-only; schemas live in `src/schema/`, one file per table
- After adding a tenant-scoped table: also add its RLS policy in `rls/`

## Workflows

```bash
# Generate migration from schema changes
pnpm --filter @ai-secretary/db db:generate

# Apply migrations (uses DATABASE_URL)
pnpm --filter @ai-secretary/db db:migrate

# Drizzle Studio (visual DB browser)
pnpm --filter @ai-secretary/db db:studio
```

## Files

- `src/schema/` — table definitions, one per file
- `migrations/` — generated SQL (Drizzle Kit output, checked in)
- `rls/` — Row-level security policies (apply after migrations)
- `src/client.ts` — connection factory + `withTenantContext` helper

## Adding a new tenant-scoped table

1. Create `src/schema/<table>.ts` with `tenantId` FK to `tenants`
2. Re-export from `src/schema/index.ts`
3. Run `pnpm db:generate` to produce migration
4. Add `ENABLE ROW LEVEL SECURITY` + policy to a new file in `rls/`
5. Update `apps/api/src/scripts/check-audit-coverage.ts` if the table is audit-scoped
