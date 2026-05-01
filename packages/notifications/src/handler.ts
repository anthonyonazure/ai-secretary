import type { NotificationGateway } from './gateway.js';
import { notificationRequestSchema } from './schemas.js';
import type { NotificationRequest, SendResult } from './types.js';

/**
 * pg-boss `notification.send` job-handler factory.
 *
 * Usage in `apps/workers`:
 *
 *   await boss.work('notification.send', createNotificationSendHandler({ gateway }));
 *
 * The handler validates the job payload, drives the gateway, and
 * returns the `SendResult` so pg-boss can persist it on the job row.
 * Failed-but-retryable results throw → pg-boss retries with backoff.
 * Failed-but-permanent and suppressed results resolve normally so
 * pg-boss marks the job done.
 *
 * TODO(Story 1.4): consume tenant-context plugin once it lands —
 * jobs already carry `tenantId` per CLAUDE.md "Multi-tenancy & region"
 * rule, so the handler will set `app.current_tenant_id` before invoking
 * the gateway once `apps/workers/src/lib/job-context.ts` exists.
 */
export const QUEUE_NAME = 'notification.send' as const;

/**
 * Strips zod-introduced `key: undefined` shapes so the value matches our
 * strict `NotificationRequest` (which uses `exactOptionalPropertyTypes`
 * — present-or-absent, not present-with-undefined).
 */
const toNotificationRequest = (
  parsed: ReturnType<typeof notificationRequestSchema.parse>,
): NotificationRequest => {
  const recipient: NotificationRequest['recipient'] =
    parsed.recipient.channel === 'push'
      ? {
          channel: 'push',
          userId: parsed.recipient.userId,
          pushTokens: parsed.recipient.pushTokens,
        }
      : {
          channel: 'email',
          email: parsed.recipient.email,
          ...(parsed.recipient.userId !== undefined ? { userId: parsed.recipient.userId } : {}),
          ...(parsed.recipient.name !== undefined ? { name: parsed.recipient.name } : {}),
        };

  const payload: NotificationRequest['payload'] =
    parsed.payload.channel === 'push'
      ? {
          channel: 'push',
          title: parsed.payload.title,
          body: parsed.payload.body,
          ...(parsed.payload.data !== undefined ? { data: parsed.payload.data } : {}),
        }
      : {
          channel: 'email',
          context: parsed.payload.context,
          ...(parsed.payload.locale !== undefined ? { locale: parsed.payload.locale } : {}),
          ...(parsed.payload.from !== undefined ? { from: parsed.payload.from } : {}),
        };

  return {
    tenantId: parsed.tenantId,
    kind: parsed.kind,
    recipient,
    payload,
    ...(parsed.dedupKey !== undefined ? { dedupKey: parsed.dedupKey } : {}),
  };
};

export interface NotificationJob {
  /** pg-boss-assigned job id; bound at handler invocation time. */
  id: string;
  data: unknown;
}

export const createNotificationSendHandler = (deps: {
  gateway: NotificationGateway;
}) => {
  return async (job: NotificationJob): Promise<SendResult> => {
    const parsed = notificationRequestSchema.safeParse(job.data);
    if (!parsed.success) {
      // Bad payload is permanent; throw so pg-boss can dead-letter
      // (we use throw here intentionally — pg-boss treats throws as
      // job failures, and bad-payload retries would just fail again).
      throw new Error(
        `notification.send: invalid payload — ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const req = toNotificationRequest(parsed.data);
    const result = await deps.gateway.send(req);

    // Surface retryable failures via throw so pg-boss reschedules.
    if (!result.ok && result.retryable) {
      throw new Error(`notification.send transient failure: ${result.error}`);
    }
    return result;
  };
};
