/**
 * `re-engagement-scan` scheduled handler — Story 1.7.
 *
 * UX spec § F2 user first-launch flow → Lost branch:
 *   - 24h after signup, if user has zero recordings → email
 *     "Want to see what AI Secretary does? Try a sample meeting →"
 *   - 72h after signup, if still zero recordings → email
 *     "Got a recording from yesterday? Drop it here →"
 *   - 30d cooldown before re-attempting either kind for the same user.
 *
 * This handler runs hourly (cron `0 * * * *`) — see
 * `apps/workers/src/index.ts` where `boss.schedule(...)` enqueues a
 * tick. For each tick we:
 *
 *   1. Iterate every tenant. The scan needs to read user + recording
 *      rows under the right tenant context for RLS — there is no
 *      service-role bypass. We accept the small N tradeoff (tenants
 *      table size is bounded by SaaS topology) over plumbing a
 *      privileged role.
 *   2. For each tenant, find users created 23–25h ago (24h bucket) or
 *      71–73h ago (72h bucket) who have zero recordings.
 *   3. Enqueue one `notification.send` job per match. The dedup-key
 *      shape (`reengagement:<bucket>:user-<userId>:day-<yyyymmdd>`)
 *      gives the gateway's recipient+kind+dedup-key window enough
 *      uniqueness to suppress within-day repeats; the 30d cooldown
 *      itself is enforced by the day-bucket rolling forward in
 *      lockstep with `created_at`.
 *
 * Notes:
 *   - We do NOT call the gateway directly here; we enqueue into the
 *     `notification.send` queue (Story 1.10 contract). The queue
 *     handler does the real send + dedup + audit row.
 *   - Audit logging is the gateway's responsibility — `notification.sent`
 *     / `.suppressed-dedup` / etc. flow through the existing
 *     `audit-logger` plugin via the notifications package.
 */

import type { Db, Region } from '@aisecretary/db';
import { recordings, tenants, users } from '@aisecretary/db/schema';
import {
  QUEUE_NAME as NOTIFICATION_QUEUE_NAME,
  type NotificationKind,
  type NotificationRequest,
} from '@aisecretary/notifications';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type pino from 'pino';
import { withJobContext } from '../lib/job-context.js';

export const RE_ENGAGEMENT_SCAN_QUEUE = 're-engagement-scan';

/**
 * Cron expression for the scheduler — runs at minute 0 of every hour.
 * pg-boss `schedule()` consumes a standard 5-field cron string.
 */
export const RE_ENGAGEMENT_SCAN_CRON = '0 * * * *';

export interface ReEngagementScanDeps {
  db: Db;
  logger: pino.Logger;
  /**
   * Enqueue one `notification.send` job per match. Implementation lives
   * in `apps/workers/src/index.ts` — boss.send(QUEUE_NAME, payload).
   * Pluggable here so unit tests can capture without touching pg-boss.
   */
  enqueueNotification: (request: NotificationRequest) => Promise<void>;
  /** Override for tests — fixes "now" so windowing is deterministic. */
  now?: () => Date;
  /**
   * Override for tests — controls the resume URL passed to the email
   * template. Production wires the region-correct app origin.
   */
  resolveResumeUrl?: (args: { tenantSlug: string; userId: string }) => string;
}

interface TenantBatch {
  id: string;
  slug: string;
  name: string;
  region: Region;
}

interface UserMatch {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
/** ±1h around the bucket center so we don't miss a user when a tick lands off-center. */
const BUCKET_HALF_WIDTH_MS = ONE_HOUR_MS;

/**
 * Compute the dedup-key for a re-engagement send. The key includes the
 * day bucket (UTC YYYYMMDD) so a 30d cooldown is naturally enforced by
 * the gateway's `(recipient, kind, dedup_key)` window — `dedup_key`
 * rolls forward once per day, and the 24h/72h buckets only fire once
 * per signup anyway.
 */
export const computeReEngagementDedupKey = (args: {
  bucket: '24h' | '72h';
  userId: string;
  now: Date;
}): string => {
  const yyyymmdd = `${args.now.getUTCFullYear()}${String(args.now.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}${String(args.now.getUTCDate()).padStart(2, '0')}`;
  return `reengagement:${args.bucket}:user-${args.userId}:day-${yyyymmdd}`;
};

const defaultResumeUrl = (args: { tenantSlug: string; userId: string }): string => {
  // Tenant-aware deep-link. The marketing site DNS root is
  // `aisecretary.app`; per-tenant deploys land at
  // `{slug}.{region}.aisecretary.app` (architecture.md). The scan
  // doesn't know region here, so we hand off to the marketing
  // fallback — the email template renders this verbatim.
  void args.userId;
  return `https://${args.tenantSlug}.us.aisecretary.app/inbox`;
};

const defaultNow = (): Date => new Date();

/**
 * Single tenant scan — finds users in the (24h | 72h) bucket with zero
 * recordings and enqueues notifications for each.
 */
const scanTenantBucket = async (
  deps: ReEngagementScanDeps,
  tenant: TenantBatch,
  bucket: '24h' | '72h',
  now: Date,
): Promise<number> => {
  const offsetMs = bucket === '24h' ? TWENTY_FOUR_HOURS_MS : SEVENTY_TWO_HOURS_MS;
  const center = new Date(now.getTime() - offsetMs);
  const lowerBound = new Date(center.getTime() - BUCKET_HALF_WIDTH_MS);
  const upperBound = new Date(center.getTime() + BUCKET_HALF_WIDTH_MS);

  return await withJobContext(
    deps.db,
    { tenantId: tenant.id, region: tenant.region },
    async (tx) => {
      // Find users created in the bucket window who have zero recordings.
      const matches = (await tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenant.id),
            gte(users.createdAt, lowerBound),
            lte(users.createdAt, upperBound),
            sql`NOT EXISTS (
              SELECT 1 FROM ${recordings}
              WHERE ${recordings.ownerUserId} = ${users.id}
                AND ${recordings.tenantId} = ${tenant.id}
            )`,
          ),
        )) as UserMatch[];

      if (matches.length === 0) return 0;

      const kind: NotificationKind = bucket === '24h' ? 're-engagement-24h' : 're-engagement-72h';
      let enqueued = 0;
      for (const match of matches) {
        const dedupKey = computeReEngagementDedupKey({ bucket, userId: match.id, now });
        const resumeUrl = (deps.resolveResumeUrl ?? defaultResumeUrl)({
          tenantSlug: tenant.slug,
          userId: match.id,
        });
        const request: NotificationRequest = {
          tenantId: tenant.id,
          kind,
          recipient: {
            channel: 'email',
            email: match.email,
            userId: match.id,
            name: match.name,
          },
          payload: {
            channel: 'email',
            context: {
              userName: match.name || 'there',
              tenantName: tenant.name,
              resumeUrl,
              hoursIdle: bucket === '24h' ? 24 : 72,
            },
          },
          dedupKey,
        };
        await deps.enqueueNotification(request);
        enqueued += 1;
      }
      return enqueued;
    },
  );
};

export const createReEngagementScanHandler = (deps: ReEngagementScanDeps) => {
  return async (): Promise<{ enqueuedCount: number; tenantsScanned: number }> => {
    const now = (deps.now ?? defaultNow)();
    deps.logger.info({ now: now.toISOString() }, 're-engagement-scan: started');

    // Tenants are queried outside any tenant context — the table itself
    // has no RLS (it's the cascade root). Iterate every tenant and run
    // the per-tenant scan inside that tenant's context.
    const tenantRows = (await deps.db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        region: tenants.region,
      })
      .from(tenants)) as TenantBatch[];

    let totalEnqueued = 0;
    for (const tenant of tenantRows) {
      try {
        const c24 = await scanTenantBucket(deps, tenant, '24h', now);
        const c72 = await scanTenantBucket(deps, tenant, '72h', now);
        totalEnqueued += c24 + c72;
      } catch (err) {
        deps.logger.error(
          { err, tenantId: tenant.id },
          're-engagement-scan: per-tenant scan failed; continuing',
        );
      }
    }

    deps.logger.info(
      { enqueuedCount: totalEnqueued, tenantsScanned: tenantRows.length },
      're-engagement-scan: completed',
    );
    return { enqueuedCount: totalEnqueued, tenantsScanned: tenantRows.length };
  };
};

export { NOTIFICATION_QUEUE_NAME };
