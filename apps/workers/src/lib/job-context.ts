import { type Db, type Region, withTenantContext } from '@aisecretary/db';

/**
 * `withJobContext` — workers-side counterpart to the API's `tenant-context`
 * Fastify plugin. Every pg-boss job payload carries
 * `{ tenantId, region, ... }`; handlers wrap their Drizzle calls with this
 * helper so RLS sees the right tenant + region for the duration of the
 * handler.
 *
 * Pattern (from architecture.md § "Tenant + region context propagation"):
 *
 *   await withJobContext(db, payload, async (txDb) => {
 *     return await txDb.select().from(meetings).where(...);
 *   });
 *
 * No Fastify wiring — this is a pure async helper. Worker boot lives in a
 * future story; today this file is just the contract that handlers will
 * import.
 */
export interface JobContext {
  tenantId: string;
  region: Region;
  /** Optional actor for system-initiated jobs; null is fine. */
  userId?: string | null;
}

export const withJobContext = async <T>(
  db: Db,
  ctx: JobContext,
  fn: (db: Db) => Promise<T>,
): Promise<T> => {
  return await withTenantContext(
    db,
    {
      tenantId: ctx.tenantId,
      region: ctx.region,
      ...(ctx.userId !== undefined ? { userId: ctx.userId } : {}),
    },
    fn,
  );
};
