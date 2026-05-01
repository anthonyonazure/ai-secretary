/**
 * Repository seam for the action-items routes (Story 8.5 — My Actions).
 *
 * The `action_items` rows are written by the Story 3.3 worker. The My
 * Actions surface only reads + transitions the lifecycle (status FSM):
 *
 *   pending → accepted → done
 *           ↘ dismissed
 *
 * Cross-meeting list joins `action_items` against `meetings` for the
 * source-meeting backlink shape (id + title + recordedAt). RLS keeps
 * everything strictly in-tenant.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { actionItems, meetings } from '@aisecretary/db/schema';
import type { CitationRef } from '@aisecretary/shared';
import { type SQL, and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export type ActionItemStatus = 'pending' | 'accepted' | 'done' | 'dismissed';

export interface ActionItemListRow {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingRecordedAt: Date | null;
  text: string;
  ownerName: string | null;
  ownerUserId: string | null;
  dueDate: Date | null;
  status: ActionItemStatus;
  /** numeric(4,3) → number | null (postgres-js returns string). */
  confidence: number | null;
  citations: CitationRef[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ListActionItemsInput {
  tenantId: string;
  status?: ActionItemStatus[];
  meetingId?: string;
  dueBefore?: Date;
  cursor: string | null;
  limit: number;
}

export interface ListActionItemsResult {
  items: ActionItemListRow[];
  nextCursor: string | null;
  totalCount: number;
}

export interface UpdateActionItemStatusInput {
  tenantId: string;
  id: string;
  status: ActionItemStatus;
}

export class ActionItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Action item ${id} not found.`);
    this.name = 'ActionItemNotFoundError';
  }
}

export interface ActionItemsRepository {
  list(input: ListActionItemsInput): Promise<ListActionItemsResult>;
  updateStatus(input: UpdateActionItemStatusInput): Promise<ActionItemListRow>;
}

const CURSOR_DELIM = '|';

const decodeCursor = (cursor: string | null): { updatedAt: Date; id: string } | null => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [iso, id] = raw.split(CURSOR_DELIM);
    if (!iso || !id) return null;
    const updatedAt = new Date(iso);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
};

const encodeCursor = (updatedAt: Date, id: string): string => {
  const raw = `${updatedAt.toISOString()}${CURSOR_DELIM}${id}`;
  return Buffer.from(raw, 'utf8').toString('base64');
};

export const __actionItemsCursorCodec = { decode: decodeCursor, encode: encodeCursor };

/** Postgres jsonb returns unknown — narrow safely without throwing. */
const coerceCitations = (raw: unknown): CitationRef[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is CitationRef => {
    if (!r || typeof r !== 'object') return false;
    const c = r as Record<string, unknown>;
    return (
      typeof c.meetingId === 'string' &&
      typeof c.turnId === 'string' &&
      typeof c.spanStartMs === 'number' &&
      typeof c.spanEndMs === 'number'
    );
  });
};

export class DrizzleActionItemsRepository implements ActionItemsRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async list(input: ListActionItemsInput): Promise<ListActionItemsResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const cursor = decodeCursor(input.cursor);
        const conditions: SQL[] = [eq(actionItems.tenantId, input.tenantId)];
        if (input.status && input.status.length > 0) {
          conditions.push(inArray(actionItems.status, input.status));
        }
        if (input.meetingId) {
          conditions.push(eq(actionItems.meetingId, input.meetingId));
        }
        if (input.dueBefore) {
          conditions.push(lte(actionItems.dueDate, input.dueBefore));
        }
        if (cursor) {
          conditions.push(
            sql`(${actionItems.updatedAt}, ${actionItems.id}) < (${cursor.updatedAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
          );
        }
        const whereClause = and(...conditions);

        const rows = await tx
          .select({
            id: actionItems.id,
            meetingId: actionItems.meetingId,
            meetingTitle: meetings.title,
            meetingRecordedAt: meetings.startedAt,
            text: actionItems.text,
            ownerName: actionItems.ownerName,
            ownerUserId: actionItems.ownerUserId,
            dueDate: actionItems.dueDate,
            status: actionItems.status,
            confidence: actionItems.confidence,
            citations: actionItems.citations,
            createdAt: actionItems.createdAt,
            updatedAt: actionItems.updatedAt,
          })
          .from(actionItems)
          .innerJoin(meetings, eq(meetings.id, actionItems.meetingId))
          .where(whereClause)
          .orderBy(desc(actionItems.updatedAt), desc(actionItems.id))
          .limit(input.limit + 1);

        const totalRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(actionItems)
          .where(eq(actionItems.tenantId, input.tenantId));
        const totalCount = Number(totalRows[0]?.count ?? 0);

        const hasMore = rows.length > input.limit;
        const trimmed = hasMore ? rows.slice(0, input.limit) : rows;
        const last = trimmed[trimmed.length - 1];
        const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;

        return {
          items: trimmed.map((r) => ({
            id: r.id,
            meetingId: r.meetingId,
            meetingTitle: r.meetingTitle,
            meetingRecordedAt: r.meetingRecordedAt,
            text: r.text,
            ownerName: r.ownerName,
            ownerUserId: r.ownerUserId,
            dueDate: r.dueDate,
            status: r.status as ActionItemStatus,
            confidence: r.confidence === null ? null : Number(r.confidence),
            citations: coerceCitations(r.citations),
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
          nextCursor,
          totalCount,
        };
      },
    );
  }

  async updateStatus(input: UpdateActionItemStatusInput): Promise<ActionItemListRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const updated = await tx
          .update(actionItems)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(actionItems.id, input.id), eq(actionItems.tenantId, input.tenantId)))
          .returning({
            id: actionItems.id,
            meetingId: actionItems.meetingId,
            text: actionItems.text,
            ownerName: actionItems.ownerName,
            ownerUserId: actionItems.ownerUserId,
            dueDate: actionItems.dueDate,
            status: actionItems.status,
            confidence: actionItems.confidence,
            citations: actionItems.citations,
            createdAt: actionItems.createdAt,
            updatedAt: actionItems.updatedAt,
          });
        const row = updated[0];
        if (!row) throw new ActionItemNotFoundError(input.id);

        const meetingRows = await tx
          .select({
            title: meetings.title,
            startedAt: meetings.startedAt,
          })
          .from(meetings)
          .where(eq(meetings.id, row.meetingId))
          .limit(1);
        const meetingRow = meetingRows[0];

        return {
          id: row.id,
          meetingId: row.meetingId,
          meetingTitle: meetingRow?.title ?? '',
          meetingRecordedAt: meetingRow?.startedAt ?? null,
          text: row.text,
          ownerName: row.ownerName,
          ownerUserId: row.ownerUserId,
          dueDate: row.dueDate,
          status: row.status as ActionItemStatus,
          confidence: row.confidence === null ? null : Number(row.confidence),
          citations: coerceCitations(row.citations),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      },
    );
  }
}

/**
 * In-memory repository for tests + dev. Tenant id isn't on the wire row
 * shape so the in-memory store keeps a parallel `tenantId` side-map
 * keyed by row id.
 */
export class InMemoryActionItemsRepository implements ActionItemsRepository {
  public readonly rows: ActionItemListRow[] = [];
  private readonly tenantById = new Map<string, string>();

  insert(tenantId: string, row: ActionItemListRow): void {
    this.rows.push(row);
    this.tenantById.set(row.id, tenantId);
  }

  async list(input: ListActionItemsInput): Promise<ListActionItemsResult> {
    const tenantRows = this.rows.filter((r) => {
      if (this.tenantById.get(r.id) !== input.tenantId) return false;
      if (input.status && input.status.length > 0 && !input.status.includes(r.status)) return false;
      if (input.meetingId && r.meetingId !== input.meetingId) return false;
      if (input.dueBefore) {
        if (!r.dueDate || r.dueDate.getTime() > input.dueBefore.getTime()) return false;
      }
      return true;
    });

    const sorted = [...tenantRows].sort((a, b) => {
      const t = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });

    const cursor = decodeCursor(input.cursor);
    const filtered = cursor
      ? sorted.filter((r) => {
          const t = r.updatedAt.getTime();
          const c = cursor.updatedAt.getTime();
          if (t < c) return true;
          if (t === c && r.id.localeCompare(cursor.id) < 0) return true;
          return false;
        })
      : sorted;

    const totalRows = this.rows.filter((r) => this.tenantById.get(r.id) === input.tenantId);
    const slice = filtered.slice(0, input.limit + 1);
    const hasMore = slice.length > input.limit;
    const trimmed = hasMore ? slice.slice(0, input.limit) : slice;
    const last = trimmed[trimmed.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;

    return {
      items: trimmed,
      nextCursor,
      totalCount: totalRows.length,
    };
  }

  async updateStatus(input: UpdateActionItemStatusInput): Promise<ActionItemListRow> {
    const idx = this.rows.findIndex(
      (r) => r.id === input.id && this.tenantById.get(r.id) === input.tenantId,
    );
    if (idx === -1) throw new ActionItemNotFoundError(input.id);
    const existing = this.rows[idx];
    if (!existing) throw new ActionItemNotFoundError(input.id);
    const updated: ActionItemListRow = {
      ...existing,
      status: input.status,
      updatedAt: new Date(),
    };
    this.rows[idx] = updated;
    return updated;
  }
}
