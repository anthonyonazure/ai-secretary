/**
 * Drizzle-backed `BotAuditLogger` — production impl of the audit-write
 * seam the `bot.join` handler uses.
 *
 * Writes to `audit_logs` directly (not through the API's audit-logger
 * Fastify plugin, which is route-scoped). The schema enforces RLS by
 * tenant_id, so we set `app.current_tenant_id` via `withTenantContext`.
 *
 * Audit actions: `bot.session.joined`, `bot.session.ended`,
 * `bot.session.failed`. The `bot.session.provisioned` action is emitted
 * by the API route (`POST /api/v1/bot-sessions`) — never by this logger.
 *
 * `requestId` is synthesized as `bot-job-<sessionId>` since the writer
 * runs inside a pg-boss job (not an HTTP request). Keeps the column
 * non-null without polluting it with an unrelated value.
 */

import { randomUUID } from 'node:crypto';
import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { auditLogs } from '@aisecretary/db/schema';

import type { BotAuditLogInput, BotAuditLogger } from '../handlers/bot-join.js';

export interface DrizzleBotAuditLoggerOptions {
  db: Db;
  region: Region;
}

export class DrizzleBotAuditLogger implements BotAuditLogger {
  constructor(private readonly options: DrizzleBotAuditLoggerOptions) {}

  async log(input: BotAuditLogInput): Promise<void> {
    await withTenantContext(
      this.options.db,
      { tenantId: input.tenantId, region: this.options.region },
      async (tx) => {
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          metadata: input.metadata ?? {},
          requestId: `bot-job-${input.resourceId}`,
          region: this.options.region,
        });
      },
    );
  }
}
