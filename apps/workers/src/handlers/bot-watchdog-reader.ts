/**
 * Production `BotWatchdogReader` — reads in-flight bot sessions across
 * tenants for the Story 9.x watchdog.
 *
 * Mirrors `recording-watchdog-reader.ts`. The watchdog is a system-level
 * scan, so this query bypasses tenant isolation by NOT going through
 * `withTenantContext`. The DB role for the workers process must allow
 * cross-tenant SELECT on `bot_sessions` — RLS policy
 * `0016_rls_bot_sessions.sql` permits this when the workers role has
 * BYPASSRLS, which is the convention for system jobs in this codebase.
 *
 * In-flight = `status ∈ provisioning | joined` AND `created_at >= since`.
 * The notification job downstream carries tenantId + region forward.
 */

import type { Db } from '@aisecretary/db';
import { botSessions } from '@aisecretary/db/schema';
import { and, gte, inArray } from 'drizzle-orm';

import type { BotWatchdogReader, InFlightBotSession } from './bot-watchdog.js';

export class DrizzleBotWatchdogReader implements BotWatchdogReader {
  constructor(private readonly db: Db) {}

  async listInFlight({ sinceMs }: { sinceMs: number }): Promise<InFlightBotSession[]> {
    const since = new Date(sinceMs);
    const rows = await this.db
      .select({
        sessionId: botSessions.id,
        tenantId: botSessions.tenantId,
        ownerUserId: botSessions.ownerUserId,
        meetingId: botSessions.meetingId,
        region: botSessions.region,
        source: botSessions.source,
      })
      .from(botSessions)
      .where(
        and(
          inArray(botSessions.status, ['provisioning', 'joined']),
          gte(botSessions.createdAt, since),
        ),
      );

    return rows.map((r) => ({
      tenantId: r.tenantId,
      sessionId: r.sessionId,
      ownerUserId: r.ownerUserId,
      meetingId: r.meetingId,
      region: r.region,
      source: r.source,
    }));
  }
}
