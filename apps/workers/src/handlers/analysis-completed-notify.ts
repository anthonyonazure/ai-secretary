/**
 * `analysis.completed-notify` worker — Story 15.6 (FR60).
 *
 * Fires after the summarize + extract-action-items handlers both
 * complete for a meeting. Enqueues:
 *   - `notification.send` `kind: 'analysis-completed'` (push) for the
 *     meeting owner (so they get the in-app + push notification when
 *     analysis lands)
 *   - One `meeting-receipt-slack` / `meeting-receipt-teams` per
 *     configured hub-app (Story 15.x dispatch)
 *
 * The receipt URL the recipient deep-links to is derived from the
 * meeting id + tenant slug — the URL contract is `https://{slug}
 * .{region}.aisecretary.app/meetings/{id}` (per architecture.md).
 *
 * Idempotency:
 *   - Dedup-key per-(tenantId, meetingId, kind, dayBucket) prevents
 *     re-sends if the analysis pipeline re-fires after a worker crash.
 */

import type { Db, Region } from '@aisecretary/db';
import {
  QUEUE_NAME as NOTIFICATION_QUEUE_NAME,
  type NotificationKind,
  type NotificationRequest,
} from '@aisecretary/notifications';
import type pino from 'pino';
import { z } from 'zod';

import { computeDedupKey } from '../lib/dedup-bucket.js';
import { withJobContext } from '../lib/job-context.js';

export const ANALYSIS_COMPLETED_NOTIFY_QUEUE = 'analysis.completed-notify';

export const analysisCompletedJobPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
  /** Dispatcher list — production reads tenant_settings.hub_app_dispatchers. */
  hubAppKinds: z.array(z.enum(['meeting-receipt-slack', 'meeting-receipt-teams'])).default([]),
  /** Optional override of the meeting URL (used by tests). */
  meetingUrl: z.string().url().optional(),
});
export type AnalysisCompletedJobPayload = z.infer<typeof analysisCompletedJobPayloadSchema>;

export interface AnalysisCompletedJob {
  data: AnalysisCompletedJobPayload;
}

export interface AnalysisCompletedNotifyDeps {
  db: Db;
  logger: pino.Logger;
  enqueueNotification: (request: NotificationRequest) => Promise<void>;
  /**
   * Resolves the meeting deep-link URL from the (tenantId, meetingId)
   * pair. Production wires this against the tenants table for the
   * slug + the region default; tests stub.
   */
  resolveMeetingUrl?: (input: {
    tenantId: string;
    meetingId: string;
    region: Region;
  }) => Promise<string>;
  now?: () => Date;
}

const defaultResolveMeetingUrl = async (input: {
  tenantId: string;
  meetingId: string;
  region: Region;
}): Promise<string> =>
  `https://${input.tenantId}.${input.region}.aisecretary.app/meetings/${input.meetingId}`;

export const createAnalysisCompletedNotifyHandler = (deps: AnalysisCompletedNotifyDeps) => {
  return async (job: AnalysisCompletedJob): Promise<void> => {
    const parsed = analysisCompletedJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      deps.logger.error(
        { issues: parsed.error.issues },
        'analysis-completed-notify: invalid payload',
      );
      throw new Error('analysis-completed-notify: invalid payload');
    }
    const data = parsed.data;
    const now = (deps.now ?? (() => new Date()))();
    const resolveUrl = deps.resolveMeetingUrl ?? defaultResolveMeetingUrl;

    // We don't actually read anything from the DB in this slice, but
    // we still wrap in withJobContext so future enrichment (joining
    // meetings / tenant_settings) inherits RLS without restructuring.
    await withJobContext(deps.db, { tenantId: data.tenantId, region: data.region }, async (_tx) => {
      const meetingUrl =
        data.meetingUrl ??
        (await resolveUrl({
          tenantId: data.tenantId,
          meetingId: data.meetingId,
          region: data.region,
        }));

      const baseContext = {
        meetingId: data.meetingId,
        meetingUrl,
      };

      // 1) Owner push — analysis-completed.
      const pushDedup = computeDedupKey({
        signal: 'analysis-completed',
        scopeId: data.meetingId,
        cadence: 'day',
        now,
      });
      await deps.enqueueNotification({
        tenantId: data.tenantId,
        kind: 'analysis-completed' as NotificationKind,
        recipient: { channel: 'push', userId: data.ownerUserId, pushTokens: [] },
        payload: {
          channel: 'push',
          title: 'Analysis ready',
          body: 'Your meeting receipt is ready to review.',
          data: { meetingId: data.meetingId, meetingUrl },
        },
        dedupKey: pushDedup,
      });

      // 2) Hub-app dispatch fan-out.
      for (const hubKind of data.hubAppKinds) {
        const hubDedup = computeDedupKey({
          signal: hubKind,
          scopeId: data.meetingId,
          cadence: 'day',
          now,
        });
        await deps.enqueueNotification({
          tenantId: data.tenantId,
          kind: hubKind,
          recipient: { channel: 'email', email: 'hub-app-dispatcher@aisecretary.example' },
          payload: {
            channel: 'email',
            context: { ...baseContext },
          },
          dedupKey: hubDedup,
        });
      }
    });

    deps.logger.info(
      {
        tenantId: data.tenantId,
        meetingId: data.meetingId,
        hubKinds: data.hubAppKinds,
      },
      'analysis-completed-notify: dispatched',
    );
  };
};

export { NOTIFICATION_QUEUE_NAME };
