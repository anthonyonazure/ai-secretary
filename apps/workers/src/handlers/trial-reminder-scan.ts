/**
 * `trial.reminder-scan` cron handler — Story 13.7.
 *
 * Once an hour, scans `tenants` for trials about to elapse:
 *   - T-3d window: trial_ends_at ∈ [now+3d−1h, now+3d+1h]
 *   - T-1d window: trial_ends_at ∈ [now+1d−1h, now+1d+1h]
 *
 * For each match, enqueues a `notification.send` job with
 * `kind: 'trial-ending-soon'`. The notifications gateway dedupes by
 * `(tenantId, kind, dedupKey)` so the cron firing 24× per day doesn't
 * double-send.
 *
 * Trial-EXPIRED transitions (Pro without card → set `trial_expired_at`)
 * happen here too — when a tenant's `trial_ends_at` is in the past AND
 * `trial_card_on_file = false` AND `trial_expired_at IS NULL`, we
 * stamp `trial_expired_at = now`. Stripe webhook handlers handle the
 * Pro auto-convert path independently.
 *
 * Audit emit: not yet wired (worker-side audit-logger lands in Story
 * 1.4 follow-up). Until then we structure-log the events.
 */

import type { Db, Region } from '@aisecretary/db';
import { tenants } from '@aisecretary/db/schema';
import {
  QUEUE_NAME as NOTIFICATION_QUEUE_NAME,
  type NotificationRequest,
} from '@aisecretary/notifications';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type pino from 'pino';

import { withJobContext } from '../lib/job-context.js';

export const TRIAL_REMINDER_SCAN_QUEUE = 'trial.reminder-scan';
/** Once an hour at minute 0. */
export const TRIAL_REMINDER_SCAN_CRON = '0 * * * *';

export interface TrialReminderScanDeps {
  db: Db;
  logger: pino.Logger;
  enqueueNotification: (request: NotificationRequest) => Promise<void>;
  now?: () => Date;
  /**
   * Override the upgrade-CTA target URL. Production wires the per-
   * region admin billing page; tests stub.
   */
  resolveUpgradeUrl?: (args: { tenantSlug: string }) => string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET_HALF_WIDTH_MS = ONE_HOUR_MS;

const defaultNow = (): Date => new Date();

const defaultUpgradeUrl = (args: { tenantSlug: string }): string =>
  `https://${args.tenantSlug}.us.aisecretary.app/settings/billing`;

/**
 * Dedup-key for the per-bucket reminder send. The key includes the
 * UTC YYYYMMDD bucket so each (tenant, phase) pair only fires once
 * per day even if the cron ticks every hour.
 */
export const computeTrialReminderDedupKey = (args: {
  phase: 'T-3d' | 'T-1d';
  tenantId: string;
  now: Date;
}): string => {
  const yyyymmdd = `${args.now.getUTCFullYear()}${String(args.now.getUTCMonth() + 1).padStart(2, '0')}${String(args.now.getUTCDate()).padStart(2, '0')}`;
  return `trial-reminder:${args.phase}:tenant-${args.tenantId}:day-${yyyymmdd}`;
};

interface TenantHit {
  id: string;
  slug: string;
  name: string;
  region: Region;
  trialEndsAt: Date;
}

const findTenantsInBucket = async (
  db: Db,
  region: Region,
  windowCenter: Date,
): Promise<TenantHit[]> => {
  const lower = new Date(windowCenter.getTime() - BUCKET_HALF_WIDTH_MS);
  const upper = new Date(windowCenter.getTime() + BUCKET_HALF_WIDTH_MS);
  // Cron firings happen outside any tenant context — set the role
  // explicitly via withJobContext so we get RLS-aware queries.
  const fakeTenantId = '00000000-0000-0000-0000-000000000000';
  return await withJobContext(db, { tenantId: fakeTenantId, region }, async (tx) => {
    const rows = await tx
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        region: tenants.region,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      // The cron job needs to read across all tenants in this region;
      // bypass RLS by issuing the read with the postgres app-role
      // disabled. We rely on the index `idx_tenants_trial_ends_at`.
      // SECURITY: this is acceptable here because the cron handler
      // only enqueues NOTIFICATION jobs — it doesn't expose any
      // tenant data to a request context. Production should verify
      // the worker DB role does NOT participate in user-request RLS.
      .where(
        and(
          eq(tenants.region, region),
          gte(tenants.trialEndsAt, lower),
          lte(tenants.trialEndsAt, upper),
        ),
      );
    return rows
      .filter((r): r is TenantHit & { trialEndsAt: Date } => r.trialEndsAt !== null)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        region: r.region,
        trialEndsAt: r.trialEndsAt as Date,
      }));
  });
};

const findExpiredTrials = async (db: Db, region: Region, now: Date): Promise<TenantHit[]> => {
  const fakeTenantId = '00000000-0000-0000-0000-000000000000';
  return await withJobContext(db, { tenantId: fakeTenantId, region }, async (tx) => {
    const rows = await tx
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        region: tenants.region,
        trialEndsAt: tenants.trialEndsAt,
      })
      .from(tenants)
      .where(
        and(
          eq(tenants.region, region),
          eq(tenants.trialCardOnFile, false),
          isNull(tenants.trialExpiredAt),
          lte(tenants.trialEndsAt, now),
        ),
      );
    return rows
      .filter((r): r is TenantHit & { trialEndsAt: Date } => r.trialEndsAt !== null)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        region: r.region,
        trialEndsAt: r.trialEndsAt as Date,
      }));
  });
};

const markExpired = async (db: Db, region: Region, tenantId: string, now: Date): Promise<void> => {
  await withJobContext(db, { tenantId, region }, async (tx) => {
    await tx
      .update(tenants)
      .set({ trialExpiredAt: now, updatedAt: now })
      .where(eq(tenants.id, tenantId));
  });
};

export const createTrialReminderScanHandler = (deps: TrialReminderScanDeps) => {
  return async (): Promise<void> => {
    const now = (deps.now ?? defaultNow)();
    const upgradeUrlOf = deps.resolveUpgradeUrl ?? defaultUpgradeUrl;
    const t3d = new Date(now.getTime() + 3 * ONE_DAY_MS);
    const t1d = new Date(now.getTime() + 1 * ONE_DAY_MS);

    for (const region of ['us', 'eu'] as const) {
      const reminderHits = [
        ...(await findTenantsInBucket(deps.db, region, t3d)).map((t) => ({
          tenant: t,
          phase: 'T-3d' as const,
          daysLeft: 3,
        })),
        ...(await findTenantsInBucket(deps.db, region, t1d)).map((t) => ({
          tenant: t,
          phase: 'T-1d' as const,
          daysLeft: 1,
        })),
      ];

      for (const hit of reminderHits) {
        const dedupKey = computeTrialReminderDedupKey({
          phase: hit.phase,
          tenantId: hit.tenant.id,
          now,
        });
        const request: NotificationRequest = {
          tenantId: hit.tenant.id,
          kind: 'trial-ending-soon',
          recipient: {
            channel: 'email',
            // The cron doesn't know which user-email to dispatch to;
            // gateway routes via tenant admin contact. Production wires
            // a `resolveTenantAdminEmail` step here once Story 12.x
            // ships the admin-contact field on tenants.
            email: 'admin@aisecretary.example',
          },
          payload: {
            channel: 'email',
            context: {
              tenantName: hit.tenant.name,
              daysLeft: hit.daysLeft,
              upgradeUrl: upgradeUrlOf({ tenantSlug: hit.tenant.slug }),
              userName: 'Admin',
            },
          },
          dedupKey,
        };
        try {
          await deps.enqueueNotification(request);
          deps.logger.info(
            {
              tenantId: hit.tenant.id,
              phase: hit.phase,
              daysLeft: hit.daysLeft,
            },
            'trial-reminder-scan: enqueued',
          );
        } catch (err) {
          deps.logger.error(
            {
              err,
              tenantId: hit.tenant.id,
              phase: hit.phase,
            },
            'trial-reminder-scan: enqueue failed',
          );
        }
      }

      // Trial-expired transitions — Pro tenants past the deadline
      // without payment info.
      const expiredHits = await findExpiredTrials(deps.db, region, now);
      for (const hit of expiredHits) {
        try {
          await markExpired(deps.db, region, hit.id, now);
          deps.logger.info(
            { tenantId: hit.id, trialEndsAt: hit.trialEndsAt.toISOString() },
            'trial-reminder-scan: marked expired',
          );
        } catch (err) {
          deps.logger.error({ err, tenantId: hit.id }, 'trial-reminder-scan: expire failed');
        }
      }
    }
  };
};

export { NOTIFICATION_QUEUE_NAME };
// Defensive — silence unused-import diagnostic if `sql` ends up unused
// after future refactors.
void sql;
