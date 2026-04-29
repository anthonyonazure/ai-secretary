import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index.js';

export type Region = 'us' | 'eu';

export interface DbConfig {
  databaseUrl: string;
  region: Region;
  /** Pool size; default 10 for api processes, 4 for workers */
  poolSize?: number;
}

/**
 * Creates a Drizzle client connected to the configured Postgres.
 * Tenant context must be set per-request via `withTenantContext`.
 */
export const createDb = (config: DbConfig) => {
  const client = postgres(config.databaseUrl, {
    max: config.poolSize ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });
  return { db, client, region: config.region };
};

export type Db = ReturnType<typeof createDb>['db'];

/**
 * Runs `fn` with `app.current_tenant_id` and `app.current_region` set on the
 * Postgres session. RLS policies read these settings to enforce tenant isolation.
 *
 * Usage (Fastify plugin):
 *   await withTenantContext(db, { tenantId, region }, async (txDb) => {
 *     return await txDb.select().from(schema.meetings);
 *   });
 *
 * @throws if tenantId is missing — fail-closed.
 */
export const withTenantContext = async <T>(
  db: Db,
  ctx: { tenantId: string; region: Region; userId?: string | null },
  fn: (db: Db) => Promise<T>,
): Promise<T> => {
  if (!ctx.tenantId) {
    throw new Error('withTenantContext: tenantId is required');
  }
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${ctx.tenantId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_region', ${ctx.region}, true)`);
    if (ctx.userId) {
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`);
    }
    return await fn(tx as unknown as Db);
  });
};
