/**
 * Thin enqueue wrapper for the `crm.push` queue (pg-boss).
 *
 * Story 15.x — POST /api/v1/crm/push enqueues one job per push request.
 * The handler lives in `apps/workers/src/handlers/crm-push.ts`.
 */

import type { CrmProviderKind } from '@aisecretary/crm';
import type { Region } from '@aisecretary/db';

export interface CrmPushJobPayload {
  integrationId: string;
  tenantId: string;
  meetingId: string;
  region: Region;
  providerKind: CrmProviderKind;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  dealId?: string;
  createContactIfMissing: boolean;
  /** Server-generated idempotency key — re-fires resolve to the same note. */
  idempotencyKey: string;
  /** Audit-actor user id (the user who clicked Push). */
  actorUserId: string;
}

export interface CrmPushEnqueuer {
  enqueue(payload: CrmPushJobPayload): Promise<string | null>;
}

export class InMemoryCrmPushEnqueuer implements CrmPushEnqueuer {
  public readonly jobs: Array<{ id: string; payload: CrmPushJobPayload }> = [];
  private counter = 0;

  async enqueue(payload: CrmPushJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `crm-push-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}

export const CRM_PUSH_QUEUE = 'crm.push' as const;

export class PgBossCrmPushEnqueuer implements CrmPushEnqueuer {
  // biome-ignore lint/suspicious/noExplicitAny: pg-boss is the only consumer of this seam in production.
  constructor(private readonly boss: { send(name: string, data: unknown): Promise<any> }) {}

  async enqueue(payload: CrmPushJobPayload): Promise<string | null> {
    const id = await this.boss.send(CRM_PUSH_QUEUE, payload);
    return id ?? null;
  }
}
