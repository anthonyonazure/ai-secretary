/**
 * Server-side consent gate.
 *
 * Returns `'ok'` if a `consents` row exists for the given
 * (tenantId, meetingId) tuple, otherwise `'missing'`.
 *
 * TODO(Story 1.4 follow-up): wrap as Fastify plugin once apps/api ships.
 *   The plugin pattern is being established by Story 1.4 in parallel.
 *   When that lands, this function becomes the body of a Fastify
 *   `consent-check` plugin; routes that mutate meeting state declare
 *   `preHandler: [fastify.consentCheck]`. Until then, callers can
 *   import and use the function directly.
 *
 * Spec: CLAUDE.md "Recording without `consents` row = `consent-check`
 * plugin returns 403."
 */

import type { Db } from '@aisecretary/db';
import { consents } from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';

export type ConsentCheckResult = 'ok' | 'missing';

/**
 * Checks whether at least one consent acknowledgment exists for the
 * given meeting in the given tenant. RLS ensures tenant isolation;
 * the explicit `tenant_id` filter is belt-and-suspenders.
 *
 * Caller MUST have already wrapped the db in `withTenantContext`
 * (or its forthcoming Fastify-plugin equivalent) so RLS is enforced.
 */
export async function consentCheck(
  tenantId: string,
  meetingId: string,
  db: Db,
): Promise<ConsentCheckResult> {
  const rows = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.tenantId, tenantId), eq(consents.meetingId, meetingId)))
    .limit(1);

  return rows.length > 0 ? 'ok' : 'missing';
}
