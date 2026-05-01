import { and, eq, isNull, or } from 'drizzle-orm';

import type { Db } from '@aisecretary/db';
import { type NewShare, type Share as ShareRow, shares } from '@aisecretary/db/schema';

/**
 * Story 8.1 — repository seam for sender-side share grants. Mirrors the
 * pattern shipped by `auth-repository.ts` / `recordings-repository.ts` so
 * tests inject the in-memory variant + production wires Drizzle.
 *
 * Cross-org write path (writing to the receiving tenant's
 * `inbound_shares`) lives in `inbound-shares-repository.ts` to keep the
 * privileged-write surface narrow.
 */

export interface ShareCreateInput {
  tenantId: string;
  meetingId: string;
  createdByUserId: string;
  kind: ShareRow['kind'];
  scope: ShareRow['scope'];
  recipientEmail: string | null;
  tokenHash: string | null;
  expiresAt: Date;
  clipStartMs: number | null;
  clipEndMs: number | null;
  insightModuleId: string | null;
  crossOrg: boolean;
}

export interface SharesRepository {
  create(input: ShareCreateInput): Promise<ShareRow>;
  findById(id: string, tenantId: string): Promise<ShareRow | null>;
  findByMeetingId(meetingId: string, tenantId: string): Promise<ShareRow[]>;
  findByTokenHash(tokenHash: string): Promise<ShareRow | null>;
  revoke(id: string, tenantId: string, revokedByUserId: string): Promise<ShareRow | null>;
  resolveRecipient(id: string, recipientUserId: string): Promise<void>;
}

export class DrizzleSharesRepository implements SharesRepository {
  constructor(
    private readonly db: Db,
    private readonly region: 'us' | 'eu',
  ) {}

  async create(input: ShareCreateInput): Promise<ShareRow> {
    void this.region;
    const insert: NewShare = {
      tenantId: input.tenantId,
      meetingId: input.meetingId,
      createdByUserId: input.createdByUserId,
      kind: input.kind,
      scope: input.scope,
      recipientEmail: input.recipientEmail,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      clipStartMs: input.clipStartMs,
      clipEndMs: input.clipEndMs,
      insightModuleId: input.insightModuleId,
      crossOrg: input.crossOrg ? 'true' : 'false',
    };
    const [row] = await this.db.insert(shares).values(insert).returning();
    if (!row) throw new Error('shares.create: insert returned no row');
    return row;
  }

  async findById(id: string, tenantId: string): Promise<ShareRow | null> {
    const rows = await this.db
      .select()
      .from(shares)
      .where(and(eq(shares.id, id), eq(shares.tenantId, tenantId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByMeetingId(meetingId: string, tenantId: string): Promise<ShareRow[]> {
    return this.db
      .select()
      .from(shares)
      .where(and(eq(shares.meetingId, meetingId), eq(shares.tenantId, tenantId)));
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRow | null> {
    const rows = await this.db
      .select()
      .from(shares)
      .where(and(eq(shares.tokenHash, tokenHash), or(isNull(shares.revokedAt))))
      .limit(1);
    return rows[0] ?? null;
  }

  async revoke(id: string, tenantId: string, revokedByUserId: string): Promise<ShareRow | null> {
    const [row] = await this.db
      .update(shares)
      .set({ revokedAt: new Date(), revokedByUserId, updatedAt: new Date() })
      .where(and(eq(shares.id, id), eq(shares.tenantId, tenantId), isNull(shares.revokedAt)))
      .returning();
    return row ?? null;
  }

  async resolveRecipient(id: string, recipientUserId: string): Promise<void> {
    await this.db
      .update(shares)
      .set({ recipientUserId, updatedAt: new Date() })
      .where(eq(shares.id, id));
  }
}

/**
 * In-memory variant for tests. Maintains a Map keyed by id; manual
 * tenant filtering on reads.
 */
export class InMemorySharesRepository implements SharesRepository {
  public readonly rows = new Map<string, ShareRow>();

  async create(input: ShareCreateInput): Promise<ShareRow> {
    const id = crypto.randomUUID();
    const now = new Date();
    const row: ShareRow = {
      id,
      tenantId: input.tenantId,
      meetingId: input.meetingId,
      createdByUserId: input.createdByUserId,
      kind: input.kind,
      scope: input.scope,
      recipientEmail: input.recipientEmail,
      recipientUserId: null,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedByUserId: null,
      clipStartMs: input.clipStartMs,
      clipEndMs: input.clipEndMs,
      insightModuleId: input.insightModuleId,
      crossOrg: input.crossOrg ? 'true' : 'false',
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    return row;
  }

  async findById(id: string, tenantId: string): Promise<ShareRow | null> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }

  async findByMeetingId(meetingId: string, tenantId: string): Promise<ShareRow[]> {
    return [...this.rows.values()].filter(
      (r) => r.meetingId === meetingId && r.tenantId === tenantId,
    );
  }

  async findByTokenHash(tokenHash: string): Promise<ShareRow | null> {
    return (
      [...this.rows.values()].find((r) => r.tokenHash === tokenHash && r.revokedAt === null) ?? null
    );
  }

  async revoke(id: string, tenantId: string, revokedByUserId: string): Promise<ShareRow | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId || row.revokedAt !== null) return null;
    const updated: ShareRow = {
      ...row,
      revokedAt: new Date(),
      revokedByUserId,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async resolveRecipient(id: string, recipientUserId: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, recipientUserId, updatedAt: new Date() });
  }
}
