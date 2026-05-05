/**
 * Drizzle-backed `BotSessionsReadWriter` — production impl of the
 * structural slice the `bot.join` handler needs.
 *
 * Mirrors the read/update slice of
 * `apps/api/src/routes/bot-sessions-repository.ts`. We re-implement here
 * (rather than importing from apps/api) because apps/bot must not
 * depend on apps/api — both consume `packages/db` instead.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { botSessions } from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';

import type {
  BotSessionsReadWriter,
  BotSessionRow as HandlerBotSessionRow,
  UpdateBotSessionInput as HandlerUpdateBotSessionInput,
} from '../handlers/bot-join.js';

const toRow = (r: typeof botSessions.$inferSelect): HandlerBotSessionRow => ({
  id: r.id,
  tenantId: r.tenantId,
  meetingId: r.meetingId,
  ownerUserId: r.ownerUserId,
  source: r.source,
  status: r.status,
  region: r.region,
  externalMeetingId: r.externalMeetingId,
  joinedAt: r.joinedAt,
  endedAt: r.endedAt,
  failureReason: r.failureReason,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export class DrizzleBotSessionsReadWriter implements BotSessionsReadWriter {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async findById(sessionId: string, tenantId: string): Promise<HandlerBotSessionRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(botSessions)
        .where(and(eq(botSessions.id, sessionId), eq(botSessions.tenantId, tenantId)))
        .limit(1);
      const row = rows[0];
      return row ? toRow(row) : null;
    });
  }

  async update(
    sessionId: string,
    tenantId: string,
    patch: HandlerUpdateBotSessionInput,
  ): Promise<HandlerBotSessionRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const update: Partial<typeof botSessions.$inferInsert> & { updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.joinedAt !== undefined) update.joinedAt = patch.joinedAt;
      if (patch.endedAt !== undefined) update.endedAt = patch.endedAt;
      if (patch.failureReason !== undefined) update.failureReason = patch.failureReason;
      const [row] = await tx
        .update(botSessions)
        .set(update)
        .where(and(eq(botSessions.id, sessionId), eq(botSessions.tenantId, tenantId)))
        .returning();
      return row ? toRow(row) : null;
    });
  }
}
