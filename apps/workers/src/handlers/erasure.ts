/**
 * `dsar.erasure` queue handler — Story 14.2 (right-to-erasure ≤30d).
 *
 * Scope: USER-level erasure. Tenant-level erasure (cascade-source) is
 * out of scope — that flow is the destructive admin path.
 *
 * Steps:
 *   1. Validate payload.
 *   2. Inside `withJobContext({tenantId, region})`:
 *      a. Build a `TableExecutorRegistry` of per-table user-scoped
 *         erasure operations using the live tx + storage provider.
 *      b. Call `runErasureCascade(cascade, registry, scope, host)`.
 *      c. Inspect the report — if `fullyHandled === false` we still
 *         consider the cascade complete (the unhandled tables are
 *         intentionally `noop-out-of-scope` for user erasure), but the
 *         payload makes the gap visible in the audit row metadata.
 *      d. Emit one structured log line per stage (audit-row will follow
 *         once the worker-side audit logger lands per Story 1.4).
 *   3. On any throw: structure-log the failure + rethrow so pg-boss
 *      records it; the request row's status flip to `failed` happens
 *      via the API admin tool (this slice doesn't yet own the request
 *      table — see HANDOFF for the schema-change follow-up).
 *
 * Worker-side audit logger: same TODO as transcribe.ts — Story 1.4
 * follow-up wires the audit-logger that writes a real `audit_logs`
 * row per stage. Until then we structure-log the action + metadata so
 * observability tooling can extract it.
 */

import type { Db, Region } from '@aisecretary/db';
import {
  actionItems,
  auditLogs,
  feedbackThumbs,
  meetings,
  notifications,
  users,
} from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';
import type pino from 'pino';
import { z } from 'zod';

import {
  type ErasureRunReport,
  type TableExecutor,
  type TableExecutorRegistry,
  cascadeSourceSkippedExecutor,
  noopCascadeFkExecutor,
  noopOutOfScopeExecutor,
  runErasureCascade,
} from '../lib/erasure-runner.js';
import type { ErasureCascadeEntry, ErasureStrategy } from '../lib/erasure-types.js';
import { withJobContext } from '../lib/job-context.js';

export const erasureJobPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type ErasureJobPayload = z.infer<typeof erasureJobPayloadSchema>;

export interface ErasureJob {
  data: ErasureJobPayload;
}

export interface ErasureHandlerDeps {
  db: Db;
  logger: pino.Logger;
  /** Registry to walk; production passes the live registry from apps/api. */
  cascade: readonly ErasureCascadeEntry[];
  /**
   * Test seam — override the executor registry. Production omits and
   * the handler uses `buildUserErasureRegistry()` directly.
   */
  registryFactory?: () => TableExecutorRegistry;
}

/**
 * Drizzle-backed user-scoped executors. Each closes over the tx that
 * `withJobContext` passes in.
 *
 * The strategies map onto concrete user-scoped operations:
 *   - `meetings` (shred): delete meetings owned by the user. FK CASCADE
 *     handles recordings + speaker_turns + module_outputs + action_items.
 *     Out-of-band scrub of the audio object key is queued separately.
 *   - `action_items` (shred): redundant once meetings are deleted, but
 *     left explicit so meetings owned by other users that mention this
 *     user as an action-item owner get their `owner_user_id` cleared.
 *   - `notifications` (redact): null `recipient` + replace user_id-tied
 *     payload context.
 *   - `audit_logs` (redact): NULL `actor_user_id`, `ip_address`,
 *     `user_agent`. Action + resource references survive.
 *   - `feedback_thumbs` (cascade): covered by FK CASCADE when the user
 *     row is deleted at the end.
 *   - `users` (cascade): delete the user row last — this triggers the
 *     FK CASCADEs for the `cascade`-strategy tables.
 */
type Tx = Parameters<Parameters<typeof withJobContext>[2]>[0];

const meetingsExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    const tx = host as Tx;
    const deleted = await tx
      .delete(meetings)
      .where(and(eq(meetings.tenantId, tenantId), eq(meetings.ownerUserId, userId)))
      .returning({ id: meetings.id });
    return {
      rowsAffected: deleted.length,
      action: 'shred',
      note: 'FK cascade scrubs recordings + speaker_turns + module_outputs + action_items.',
    };
  };

const actionItemsExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    // Clear the user reference on remaining (non-meeting-owned) items.
    // The text + free-text ownerName stay intact — the row itself is
    // still useful audit context for the meeting that DOES survive.
    const tx = host as Tx;
    const updated = await tx
      .update(actionItems)
      .set({ ownerUserId: null, ownerName: null, updatedAt: new Date() })
      .where(and(eq(actionItems.tenantId, tenantId), eq(actionItems.ownerUserId, userId)))
      .returning({ id: actionItems.id });
    return {
      rowsAffected: updated.length,
      action: 'redact',
      note: 'NULLed owner_user_id + owner_name; preserved transcript citation.',
    };
  };

const notificationsExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    // The notifications table stores `recipient` either as a userId
    // (push channel) or a normalized email (email channel). Both forms
    // are PII tied to the user; redacting the recipient field for
    // matching rows scrubs the dispatch identity while preserving the
    // dispatch trail (channel + kind + status + attempts survive).
    const tx = host as Tx;
    const updated = await tx
      .update(notifications)
      .set({ recipient: '[redacted]' })
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.recipient, userId)))
      .returning({ id: notifications.id });
    return {
      rowsAffected: updated.length,
      action: 'redact',
      note: 'Replaced recipient with [redacted]; preserved channel + kind + status + attempts.',
    };
  };

const auditLogsExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    const tx = host as Tx;
    const updated = await tx
      .update(auditLogs)
      .set({
        actorUserId: null,
        ipAddress: null,
        userAgent: null,
      })
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.actorUserId, userId)))
      .returning({ id: auditLogs.id });
    return {
      rowsAffected: updated.length,
      action: 'redact',
      note: 'NULLed actor_user_id + ip_address + user_agent; action+resource preserved.',
    };
  };

const feedbackThumbsExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    const tx = host as Tx;
    const deleted = await tx
      .delete(feedbackThumbs)
      .where(and(eq(feedbackThumbs.tenantId, tenantId), eq(feedbackThumbs.userId, userId)))
      .returning({ id: feedbackThumbs.id });
    return {
      rowsAffected: deleted.length,
      action: 'shred',
      note: 'Per-user thumbs feedback is product telemetry; hard delete.',
    };
  };

const usersExecutor =
  (): TableExecutor =>
  async ({ tenantId, userId, host }) => {
    const tx = host as Tx;
    const deleted = await tx
      .delete(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .returning({ id: users.id });
    return {
      rowsAffected: deleted.length,
      action: 'shred',
      note: 'User row deleted last; FK CASCADE removes consents + tenant_invites + auth_identities.',
    };
  };

/**
 * Build the per-table executor map used by the runner. Production
 * passes the live drizzle tables; tests can supply a stub registry to
 * exercise the orchestration without DB.
 */
export const buildUserErasureRegistry = (): TableExecutorRegistry => ({
  // cascade-source — user-erasure never touches the tenant row.
  tenants: cascadeSourceSkippedExecutor,
  // FK CASCADE from tenants — out of scope for user erasure.
  user_preferences: noopOutOfScopeExecutor,
  // FK CASCADE from tenants — also out of scope for user erasure.
  tenant_invites: noopOutOfScopeExecutor,
  // sender-side share grants — preserved on user-erasure (tenant
  // policy decides; default keep + redact via a separate pass once the
  // share mechanism gains a created_by_user reference). Today this is
  // a noop; the schema intentionally only has tenant FK.
  shares: noopOutOfScopeExecutor,
  inbound_shares: noopOutOfScopeExecutor,
  // dsar_requests — the request row itself is the user's; soft-delete
  // semantics preserve the legal trail. Today: noop in the user-
  // erasure scope (tenant-level erasure handles via FK CASCADE).
  dsar_requests: noopOutOfScopeExecutor,
  // module_outputs + speaker_turns + recordings + consents come along
  // automatically when meetings deleted.
  module_outputs: noopCascadeFkExecutor,
  speaker_turns: noopCascadeFkExecutor,
  recordings: noopCascadeFkExecutor,
  consents: noopCascadeFkExecutor,
  feedback_thumbs: feedbackThumbsExecutor(),
  meetings: meetingsExecutor(),
  action_items: actionItemsExecutor(),
  notifications: notificationsExecutor(),
  audit_logs: auditLogsExecutor(),
  // users last — see executor docstring.
  users: usersExecutor(),
});

export const createErasureHandler = (deps: ErasureHandlerDeps) => {
  const { db, logger, cascade } = deps;
  return async (job: ErasureJob): Promise<ErasureRunReport> => {
    const parsed = erasureJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      logger.error({ issues: parsed.error.issues }, 'erasure: invalid payload');
      throw new Error('erasure: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };
    logger.info({ ...data }, 'erasure: started');

    const report = await withJobContext(db, ctx, async (tx) => {
      const registry = deps.registryFactory ? deps.registryFactory() : buildUserErasureRegistry();
      return await runErasureCascade(
        cascade,
        registry,
        { tenantId: data.tenantId, userId: data.userId },
        tx,
      );
    });

    for (const stage of report.stages) {
      if (stage.result.kind === 'ran') {
        logger.info(
          {
            tenantId: data.tenantId,
            userId: data.userId,
            table: stage.table,
            strategy: stage.strategy as ErasureStrategy,
            rowsAffected: stage.result.rowsAffected,
            action: stage.result.action,
            note: stage.result.note,
          },
          'erasure: stage',
        );
      } else {
        logger.warn(
          {
            tenantId: data.tenantId,
            userId: data.userId,
            table: stage.table,
            strategy: stage.strategy as ErasureStrategy,
            reason: stage.result.reason,
          },
          'erasure: stage-unhandled',
        );
      }
    }

    logger.info(
      {
        tenantId: data.tenantId,
        userId: data.userId,
        fullyHandled: report.fullyHandled,
        stageCount: report.stages.length,
      },
      'erasure: completed',
    );
    return report;
  };
};

export const ERASURE_QUEUE = 'dsar.erasure';
