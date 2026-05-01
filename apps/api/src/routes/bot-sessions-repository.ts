/**
 * Repository seam for the bot sessions surface (Story 9.x — chunk 2).
 *
 * The producer side (`apps/bot`) consumes this through the API at job
 * dispatch time + during FSM transitions. The receive-side substrate
 * (`apps/workers/src/handlers/bot-watchdog-reader.ts`) talks to the
 * same `bot_sessions` table directly — that scan is cross-tenant by
 * design (system-level), so it doesn't go through this repository.
 *
 * Cursor format mirrors `meetings-repository.ts`: base64 of
 * `createdAtIso|id` for tie-break stability.
 *
 * `external_meeting_passcode` is intentionally NEVER returned by any
 * repository read — the column exists for the producer to retrieve
 * during join-time, but only via a dedicated `findCredentialsForJoin`
 * call from the bot worker (NOT exposed in any HTTP route).
 */

import { randomUUID } from 'node:crypto';
import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { botSessions } from '@aisecretary/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export type BotSource = 'zoom_bot' | 'teams_bot';
export type BotSessionStatus = 'provisioning' | 'joined' | 'ended' | 'failed';

export interface BotSessionRow {
  id: string;
  tenantId: string;
  meetingId: string | null;
  ownerUserId: string;
  source: BotSource;
  status: BotSessionStatus;
  region: Region;
  externalMeetingId: string;
  joinedAt: Date | null;
  endedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBotSessionInput {
  tenantId: string;
  meetingId: string | null;
  ownerUserId: string;
  source: BotSource;
  region: Region;
  externalMeetingId: string;
  /** Optional pre-shared passcode. NEVER returned in reads. */
  externalMeetingPasscode?: string;
}

export interface UpdateBotSessionInput {
  status?: BotSessionStatus;
  joinedAt?: Date | null;
  endedAt?: Date | null;
  failureReason?: string | null;
}

export interface ListBotSessionsInput {
  tenantId: string;
  /** Filter by owning user — drives mobile/web "my bot sessions" view. */
  ownerUserId?: string;
  /** Filter by meeting. Useful when surfacing bot status on meeting detail. */
  meetingId?: string;
  /** Page size; capped server-side. */
  limit: number;
  /** Opaque cursor token (base64 of `createdAt|id`); null = first page. */
  cursor: string | null;
}

export interface ListBotSessionsResult {
  items: BotSessionRow[];
  nextCursor: string | null;
  totalCount: number;
}

export interface BotSessionsRepository {
  create(input: CreateBotSessionInput): Promise<BotSessionRow>;
  findById(sessionId: string, tenantId: string): Promise<BotSessionRow | null>;
  /**
   * Apply FSM-driven updates. The CALLER is responsible for validating
   * the transition (use `applyEvent` from `@aisecretary/bot/fsm`). This
   * repo is a dumb persistence surface — it does NOT enforce the FSM.
   */
  update(
    sessionId: string,
    tenantId: string,
    patch: UpdateBotSessionInput,
  ): Promise<BotSessionRow | null>;
  list(input: ListBotSessionsInput): Promise<ListBotSessionsResult>;
}

const CURSOR_DELIM = '|';

const decodeCursor = (cursor: string | null): { createdAt: Date; id: string } | null => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [iso, id] = raw.split(CURSOR_DELIM);
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
};

const encodeCursor = (createdAt: Date, id: string): string => {
  const raw = `${createdAt.toISOString()}${CURSOR_DELIM}${id}`;
  return Buffer.from(raw, 'utf8').toString('base64');
};

export const __cursorCodec = { decode: decodeCursor, encode: encodeCursor };

const toRow = (r: typeof botSessions.$inferSelect): BotSessionRow => ({
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

export class DrizzleBotSessionsRepository implements BotSessionsRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async create(input: CreateBotSessionInput): Promise<BotSessionRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const [row] = await tx
          .insert(botSessions)
          .values({
            tenantId: input.tenantId,
            meetingId: input.meetingId,
            ownerUserId: input.ownerUserId,
            source: input.source,
            region: input.region,
            externalMeetingId: input.externalMeetingId,
            externalMeetingPasscode: input.externalMeetingPasscode ?? null,
          })
          .returning();
        if (!row) throw new Error('bot_sessions.create returned no row');
        return toRow(row);
      },
    );
  }

  async findById(sessionId: string, tenantId: string): Promise<BotSessionRow | null> {
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
    patch: UpdateBotSessionInput,
  ): Promise<BotSessionRow | null> {
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

  async list(input: ListBotSessionsInput): Promise<ListBotSessionsResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const cursor = decodeCursor(input.cursor);
        const baseConditions = [eq(botSessions.tenantId, input.tenantId)];
        if (input.ownerUserId) baseConditions.push(eq(botSessions.ownerUserId, input.ownerUserId));
        if (input.meetingId) baseConditions.push(eq(botSessions.meetingId, input.meetingId));

        const whereClause = cursor
          ? and(
              ...baseConditions,
              sql`(${botSessions.createdAt}, ${botSessions.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
            )
          : and(...baseConditions);

        const rows = await tx
          .select()
          .from(botSessions)
          .where(whereClause)
          .orderBy(desc(botSessions.createdAt), desc(botSessions.id))
          .limit(input.limit + 1);

        const totalRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(botSessions)
          .where(and(...baseConditions));
        const totalCount = Number(totalRows[0]?.count ?? 0);

        const hasMore = rows.length > input.limit;
        const trimmed = hasMore ? rows.slice(0, input.limit) : rows;
        const last = trimmed[trimmed.length - 1];
        const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

        return {
          items: trimmed.map(toRow),
          nextCursor,
          totalCount,
        };
      },
    );
  }
}

/**
 * In-memory repository for tests. Mirrors `InMemoryMeetingsRepository`.
 */
export class InMemoryBotSessionsRepository implements BotSessionsRepository {
  public readonly rows: BotSessionRow[] = [];
  /** Optional id factory — tests can pin a deterministic id. Defaults to UUID v4. */
  public idFactory: () => string = () => randomUUID();
  /** Optional clock — tests can pin a deterministic timestamp. */
  public now: () => Date = () => new Date();

  async create(input: CreateBotSessionInput): Promise<BotSessionRow> {
    const ts = this.now();
    const row: BotSessionRow = {
      id: this.idFactory(),
      tenantId: input.tenantId,
      meetingId: input.meetingId,
      ownerUserId: input.ownerUserId,
      source: input.source,
      status: 'provisioning',
      region: input.region,
      externalMeetingId: input.externalMeetingId,
      joinedAt: null,
      endedAt: null,
      failureReason: null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.rows.push(row);
    return { ...row };
  }

  async findById(sessionId: string, tenantId: string): Promise<BotSessionRow | null> {
    const found = this.rows.find((r) => r.id === sessionId && r.tenantId === tenantId);
    return found ? { ...found } : null;
  }

  async update(
    sessionId: string,
    tenantId: string,
    patch: UpdateBotSessionInput,
  ): Promise<BotSessionRow | null> {
    const idx = this.rows.findIndex((r) => r.id === sessionId && r.tenantId === tenantId);
    if (idx === -1) return null;
    const current = this.rows[idx];
    if (!current) return null;
    const updated: BotSessionRow = {
      ...current,
      status: patch.status ?? current.status,
      joinedAt: patch.joinedAt !== undefined ? patch.joinedAt : current.joinedAt,
      endedAt: patch.endedAt !== undefined ? patch.endedAt : current.endedAt,
      failureReason:
        patch.failureReason !== undefined ? patch.failureReason : current.failureReason,
      updatedAt: this.now(),
    };
    this.rows[idx] = updated;
    return { ...updated };
  }

  async list(input: ListBotSessionsInput): Promise<ListBotSessionsResult> {
    const filtered = this.rows.filter((r) => {
      if (r.tenantId !== input.tenantId) return false;
      if (input.ownerUserId && r.ownerUserId !== input.ownerUserId) return false;
      if (input.meetingId && r.meetingId !== input.meetingId) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const t = b.createdAt.getTime() - a.createdAt.getTime();
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });
    const cursor = decodeCursor(input.cursor);
    const sliceSrc = cursor
      ? sorted.filter((m) => {
          const ct = m.createdAt.getTime();
          const cct = cursor.createdAt.getTime();
          if (ct < cct) return true;
          if (ct === cct && m.id.localeCompare(cursor.id) < 0) return true;
          return false;
        })
      : sorted;
    const slice = sliceSrc.slice(0, input.limit + 1);
    const hasMore = slice.length > input.limit;
    const trimmed = hasMore ? slice.slice(0, input.limit) : slice;
    const last = trimmed[trimmed.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      items: trimmed.map((r) => ({ ...r })),
      nextCursor,
      totalCount: filtered.length,
    };
  }
}
