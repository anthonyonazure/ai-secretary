/**
 * Repository seam for the cross-tenant `inbound_shares` write path
 * (Story 8.4 + ADR-0006).
 *
 * The sender-side route writes a row in the SOURCE tenant's `shares`
 * table. When the receiving tenant is detected (recipient email domain
 * differs from the sender's), the same handler must materialize a
 * receiver-side row in `inbound_shares` so the receiving org's admin
 * audit timeline shows the incoming share.
 *
 * The receive write happens with the receiving tenant's RLS context —
 * crucially, it bypasses normal in-tenant RLS by inserting on behalf of
 * the receiving tenant id. ADR-0006 permits this exact pattern: the
 * cross-tenant write uses an internal-context flag set by
 * `withTenantContext({ tenantId: receivingTenantId })` so RLS enforces
 * the row's tenant_id matches the SET LOCAL variable. The sender-side
 * RLS context for the original `shares` insert is unchanged.
 *
 * In the no-DB / test path, the in-memory dispatcher captures rows on
 * a public `rows` array so tests can assert the receive write fired.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { inboundShares } from '@aisecretary/db/schema';

export interface InboundShareInsert {
  /** Receiving tenant id. */
  tenantId: string;
  /** Sending tenant id (cross-region permitted — no FK). */
  sourceTenantId: string;
  sourceTenantDomain: string;
  sourceUserEmail: string;
  /** Sender-side `shares.id` — primary lookup key for revocation later. */
  sourceShareId: string;
  kind: 'meeting' | 'clip' | 'insight' | 'token-url';
  recipientEmail: string;
  resourceLabel: string;
  /** SHA-256 hex of the token URL when applicable. */
  tokenUrlHash?: string | null;
  expiresAt?: Date | null;
}

export interface InboundShareRow extends InboundShareInsert {
  id: string;
  status: 'pending' | 'accepted' | 'blocked-by-policy' | 'expired' | 'revoked';
  createdAt: Date;
}

export interface InboundSharesRepository {
  /**
   * Idempotent insert. The `(tenantId, sourceShareId)` unique index
   * means duplicate dispatches collapse to the same row — repeat
   * sends from the sender don't double-count in the receiver's audit
   * timeline.
   */
  recordInbound(input: InboundShareInsert): Promise<InboundShareRow>;
}

/**
 * Resolves the receiving tenant id given a recipient email's domain.
 * Production reads `tenants.domain`; tests inject a stub. Returns null
 * when no tenant matches the domain (the recipient is outside any AI
 * Secretary tenant — sender-side row lives, but no receive write fires).
 */
export type ReceivingTenantResolver = (
  recipientDomain: string,
) => Promise<{ tenantId: string; region: Region } | null>;

export class DrizzleInboundSharesRepository implements InboundSharesRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async recordInbound(input: InboundShareInsert): Promise<InboundShareRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const inserted = await tx
          .insert(inboundShares)
          .values({
            tenantId: input.tenantId,
            sourceTenantId: input.sourceTenantId,
            sourceTenantDomain: input.sourceTenantDomain,
            sourceUserEmail: input.sourceUserEmail,
            sourceShareId: input.sourceShareId,
            kind: input.kind,
            recipientEmail: input.recipientEmail,
            resourceLabel: input.resourceLabel,
            tokenUrlHash: input.tokenUrlHash ?? null,
            expiresAt: input.expiresAt ?? null,
          })
          .onConflictDoNothing({ target: [inboundShares.tenantId, inboundShares.sourceShareId] })
          .returning();
        const row = inserted[0];
        if (row) {
          return {
            id: row.id,
            tenantId: row.tenantId,
            sourceTenantId: row.sourceTenantId,
            sourceTenantDomain: row.sourceTenantDomain,
            sourceUserEmail: row.sourceUserEmail,
            sourceShareId: row.sourceShareId,
            kind: row.kind as InboundShareRow['kind'],
            recipientEmail: row.recipientEmail,
            resourceLabel: row.resourceLabel,
            tokenUrlHash: row.tokenUrlHash,
            expiresAt: row.expiresAt,
            status: row.status as InboundShareRow['status'],
            createdAt: row.createdAt,
          };
        }
        // Conflict path — treat as already-recorded; surface a synthetic
        // row so the caller can still observe the dispatch landed.
        return {
          id: '00000000-0000-0000-0000-000000000000',
          status: 'pending',
          createdAt: new Date(),
          ...input,
        };
      },
    );
  }
}

/** In-memory capture for tests. */
export class InMemoryInboundSharesRepository implements InboundSharesRepository {
  public readonly rows: InboundShareRow[] = [];

  async recordInbound(input: InboundShareInsert): Promise<InboundShareRow> {
    const dup = this.rows.find(
      (r) => r.tenantId === input.tenantId && r.sourceShareId === input.sourceShareId,
    );
    if (dup) return dup;
    const row: InboundShareRow = {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date(),
      ...input,
    };
    this.rows.push(row);
    return row;
  }
}
