/**
 * Repository seam for the cross-org accept-policy (Story 12.7).
 *
 * Persists per-tenant policy choices that gate inbound shares at
 * view-time. The DB table is `tenant_cross_org_policy` (one row per
 * tenant); the in-memory variant mirrors the same shape so the route
 * is testable without a Postgres process.
 */

export type CrossOrgPolicyKind = 'accept-all' | 'whitelist' | 'block-all';

export interface CrossOrgPolicyRow {
  tenantId: string;
  kind: CrossOrgPolicyKind;
  whitelist: string[];
  updatedAt: Date;
}

export interface UpdateInput {
  tenantId: string;
  kind: CrossOrgPolicyKind;
  whitelist?: string[];
}

export interface CrossOrgPolicyRepository {
  findByTenantId(tenantId: string): Promise<CrossOrgPolicyRow>;
  upsert(input: UpdateInput): Promise<CrossOrgPolicyRow>;
  /**
   * Story 12.7 enforcement helper — given a (receiving tenant id,
   * sender domain) pair, returns whether the share should be visible
   * at the recipient's view-time. Pure function over the row state.
   */
  evaluate(input: {
    tenantId: string;
    senderDomain: string;
  }): Promise<{
    accepted: boolean;
    reason: 'accept-all' | 'whitelist-match' | 'whitelist-miss' | 'block-all';
  }>;
}

const DEFAULT_KIND: CrossOrgPolicyKind = 'accept-all';

/** In-memory variant — defaults to 'accept-all' for tenants without a row. */
export class InMemoryCrossOrgPolicyRepository implements CrossOrgPolicyRepository {
  public readonly rows = new Map<string, CrossOrgPolicyRow>();

  async findByTenantId(tenantId: string): Promise<CrossOrgPolicyRow> {
    const existing = this.rows.get(tenantId);
    if (existing) return existing;
    return {
      tenantId,
      kind: DEFAULT_KIND,
      whitelist: [],
      updatedAt: new Date(0),
    };
  }

  async upsert(input: UpdateInput): Promise<CrossOrgPolicyRow> {
    const row: CrossOrgPolicyRow = {
      tenantId: input.tenantId,
      kind: input.kind,
      whitelist:
        input.kind === 'whitelist' ? (input.whitelist ?? []).map((d) => d.toLowerCase()) : [],
      updatedAt: new Date(),
    };
    this.rows.set(input.tenantId, row);
    return row;
  }

  async evaluate(input: {
    tenantId: string;
    senderDomain: string;
  }): Promise<{
    accepted: boolean;
    reason: 'accept-all' | 'whitelist-match' | 'whitelist-miss' | 'block-all';
  }> {
    const row = await this.findByTenantId(input.tenantId);
    if (row.kind === 'accept-all') return { accepted: true, reason: 'accept-all' };
    if (row.kind === 'block-all') return { accepted: false, reason: 'block-all' };
    const matches = row.whitelist.includes(input.senderDomain.toLowerCase());
    return matches
      ? { accepted: true, reason: 'whitelist-match' }
      : { accepted: false, reason: 'whitelist-miss' };
  }
}
