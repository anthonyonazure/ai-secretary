/**
 * Repository seam for the CRM integrations surface (Story 15.x / ADR-0003).
 *
 * Persists `tenant_integrations` rows. The OAuth tokens are stored
 * envelope-encrypted via `@aisecretary/db`'s `encryptEnvelope`; the
 * repository never returns plaintext — callers (worker handler, audit
 * inspection) must call `getDecryptedTokensForJoin()` explicitly.
 */

import { randomUUID } from 'node:crypto';
import type { CrmProviderKind } from '@aisecretary/crm';
import {
  type Db,
  type EncryptedEnvelope,
  type KekKeyring,
  type Region,
  decryptEnvelope,
  encryptEnvelope,
  withTenantContext,
} from '@aisecretary/db';
import { tenantIntegrations } from '@aisecretary/db/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * The subset of `CrmProviderKind` that lives in the
 * `integration_provider` enum. `'mock'` is a runtime-only kind for
 * tests + dev — it never gets persisted.
 */
export type PersistedCrmProvider = Exclude<CrmProviderKind, 'mock'>;

export interface CrmIntegrationRow {
  id: string;
  tenantId: string;
  provider: PersistedCrmProvider;
  externalAccountId: string;
  accountLabel: string;
  instanceUrl: string | null;
  apiBaseUrl: string | null;
  scopes: string[];
  status: 'active' | 'revoked' | 'error';
  failureReason: string | null;
  connectedByUserId: string | null;
  connectedAt: Date;
  lastUsedAt: Date | null;
  lastTokenRefreshAt: Date | null;
  tokenExpiresAt: Date | null;
}

export interface DecryptedTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface CreateCrmIntegrationInput {
  tenantId: string;
  provider: PersistedCrmProvider;
  externalAccountId: string;
  accountLabel: string;
  instanceUrl?: string;
  apiBaseUrl?: string;
  scopes: string[];
  tokens: DecryptedTokens;
  tokenExpiresAt?: Date;
  connectedByUserId: string | null;
}

export interface CrmIntegrationsRepository {
  create(input: CreateCrmIntegrationInput): Promise<CrmIntegrationRow>;
  list(tenantId: string): Promise<CrmIntegrationRow[]>;
  findById(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null>;
  findActiveByProvider(
    tenantId: string,
    provider: PersistedCrmProvider,
  ): Promise<CrmIntegrationRow | null>;
  revoke(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null>;
  markUsed(integrationId: string, tenantId: string, at: Date): Promise<void>;
  markError(integrationId: string, tenantId: string, reason: string): Promise<void>;
  /**
   * Decrypt the envelope-encrypted OAuth tokens for the row. Used by
   * the worker handler at push time. NEVER exposed via HTTP.
   */
  getDecryptedTokensForJoin(
    integrationId: string,
    tenantId: string,
  ): Promise<DecryptedTokens | null>;
}

const toRow = (
  r: typeof tenantIntegrations.$inferSelect & { encrypted_token?: never },
): CrmIntegrationRow => ({
  id: r.id,
  tenantId: r.tenantId,
  provider: r.provider,
  externalAccountId: r.externalAccountId,
  accountLabel: r.accountLabel,
  instanceUrl: r.instanceUrl,
  apiBaseUrl: r.apiBaseUrl,
  scopes: r.scopes,
  status: r.status,
  failureReason: r.failureReason,
  connectedByUserId: r.connectedByUserId,
  connectedAt: r.connectedAt,
  lastUsedAt: r.lastUsedAt,
  lastTokenRefreshAt: r.lastTokenRefreshAt,
  tokenExpiresAt: r.tokenExpiresAt,
});

const tokensToPlaintext = (t: DecryptedTokens): string => JSON.stringify(t);
const plaintextToTokens = (p: string): DecryptedTokens => {
  const parsed = JSON.parse(p) as DecryptedTokens;
  if (!parsed.accessToken) throw new Error('decrypted token has no accessToken');
  return parsed;
};

export class DrizzleCrmIntegrationsRepository implements CrmIntegrationsRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
    private readonly keyring: KekKeyring,
  ) {}

  async create(input: CreateCrmIntegrationInput): Promise<CrmIntegrationRow> {
    const envelope = await encryptEnvelope(this.keyring, tokensToPlaintext(input.tokens));
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const [row] = await tx
          .insert(tenantIntegrations)
          .values({
            tenantId: input.tenantId,
            provider: input.provider,
            externalAccountId: input.externalAccountId,
            accountLabel: input.accountLabel,
            instanceUrl: input.instanceUrl ?? null,
            apiBaseUrl: input.apiBaseUrl ?? null,
            encryptedToken: envelope,
            scopes: input.scopes,
            status: 'active',
            connectedByUserId: input.connectedByUserId,
            tokenExpiresAt: input.tokenExpiresAt ?? null,
          })
          .returning();
        if (!row) throw new Error('tenant_integrations.create returned no row');
        return toRow(row);
      },
    );
  }

  async list(tenantId: string): Promise<CrmIntegrationRow[]> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantIntegrations)
        .where(eq(tenantIntegrations.tenantId, tenantId));
      return rows.map(toRow);
    });
  }

  async findById(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantIntegrations)
        .where(
          and(eq(tenantIntegrations.id, integrationId), eq(tenantIntegrations.tenantId, tenantId)),
        )
        .limit(1);
      const row = rows[0];
      return row ? toRow(row) : null;
    });
  }

  async findActiveByProvider(
    tenantId: string,
    provider: PersistedCrmProvider,
  ): Promise<CrmIntegrationRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantIntegrations)
        .where(
          and(
            eq(tenantIntegrations.tenantId, tenantId),
            eq(tenantIntegrations.provider, provider),
            eq(tenantIntegrations.status, 'active'),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? toRow(row) : null;
    });
  }

  async revoke(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const [row] = await tx
        .update(tenantIntegrations)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(
          and(eq(tenantIntegrations.id, integrationId), eq(tenantIntegrations.tenantId, tenantId)),
        )
        .returning();
      return row ? toRow(row) : null;
    });
  }

  async markUsed(integrationId: string, tenantId: string, at: Date): Promise<void> {
    await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      await tx
        .update(tenantIntegrations)
        .set({ lastUsedAt: at, updatedAt: at })
        .where(
          and(eq(tenantIntegrations.id, integrationId), eq(tenantIntegrations.tenantId, tenantId)),
        );
    });
  }

  async markError(integrationId: string, tenantId: string, reason: string): Promise<void> {
    await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      await tx
        .update(tenantIntegrations)
        .set({ status: 'error', failureReason: reason.slice(0, 500), updatedAt: new Date() })
        .where(
          and(eq(tenantIntegrations.id, integrationId), eq(tenantIntegrations.tenantId, tenantId)),
        );
    });
  }

  async getDecryptedTokensForJoin(
    integrationId: string,
    tenantId: string,
  ): Promise<DecryptedTokens | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select({ envelope: tenantIntegrations.encryptedToken })
        .from(tenantIntegrations)
        .where(
          and(eq(tenantIntegrations.id, integrationId), eq(tenantIntegrations.tenantId, tenantId)),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const plaintext = await decryptEnvelope(this.keyring, row.envelope as EncryptedEnvelope);
      return plaintextToTokens(plaintext);
    });
  }
}

/** In-memory impl for tests. Encryption is stubbed (plaintext stored as-is in `tokens`). */
export class InMemoryCrmIntegrationsRepository implements CrmIntegrationsRepository {
  public readonly rows: Array<CrmIntegrationRow & { tokens: DecryptedTokens }> = [];
  public idFactory: () => string = () => randomUUID();
  public now: () => Date = () => new Date();

  async create(input: CreateCrmIntegrationInput): Promise<CrmIntegrationRow> {
    const ts = this.now();
    const row: CrmIntegrationRow & { tokens: DecryptedTokens } = {
      id: this.idFactory(),
      tenantId: input.tenantId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      accountLabel: input.accountLabel,
      instanceUrl: input.instanceUrl ?? null,
      apiBaseUrl: input.apiBaseUrl ?? null,
      scopes: [...input.scopes],
      status: 'active',
      failureReason: null,
      connectedByUserId: input.connectedByUserId,
      connectedAt: ts,
      lastUsedAt: null,
      lastTokenRefreshAt: null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      tokens: { ...input.tokens },
    };
    // Enforce one active per (tenant, provider) by revoking the old.
    for (const existing of this.rows) {
      if (
        existing.tenantId === input.tenantId &&
        existing.provider === input.provider &&
        existing.status === 'active'
      ) {
        existing.status = 'revoked';
      }
    }
    this.rows.push(row);
    return rowFromInternal(row);
  }

  async list(tenantId: string): Promise<CrmIntegrationRow[]> {
    return this.rows.filter((r) => r.tenantId === tenantId).map(rowFromInternal);
  }

  async findById(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null> {
    const r = this.rows.find((x) => x.id === integrationId && x.tenantId === tenantId);
    return r ? rowFromInternal(r) : null;
  }

  async findActiveByProvider(
    tenantId: string,
    provider: PersistedCrmProvider,
  ): Promise<CrmIntegrationRow | null> {
    const r = this.rows.find(
      (x) => x.tenantId === tenantId && x.provider === provider && x.status === 'active',
    );
    return r ? rowFromInternal(r) : null;
  }

  async revoke(integrationId: string, tenantId: string): Promise<CrmIntegrationRow | null> {
    const r = this.rows.find((x) => x.id === integrationId && x.tenantId === tenantId);
    if (!r) return null;
    r.status = 'revoked';
    return rowFromInternal(r);
  }

  async markUsed(integrationId: string, tenantId: string, at: Date): Promise<void> {
    const r = this.rows.find((x) => x.id === integrationId && x.tenantId === tenantId);
    if (r) r.lastUsedAt = at;
  }

  async markError(integrationId: string, tenantId: string, reason: string): Promise<void> {
    const r = this.rows.find((x) => x.id === integrationId && x.tenantId === tenantId);
    if (r) {
      r.status = 'error';
      r.failureReason = reason.slice(0, 500);
    }
  }

  async getDecryptedTokensForJoin(
    integrationId: string,
    tenantId: string,
  ): Promise<DecryptedTokens | null> {
    const r = this.rows.find((x) => x.id === integrationId && x.tenantId === tenantId);
    return r ? { ...r.tokens } : null;
  }
}

const rowFromInternal = (r: CrmIntegrationRow & { tokens: DecryptedTokens }): CrmIntegrationRow => {
  const { tokens: _t, ...rest } = r;
  void _t;
  return { ...rest, scopes: [...rest.scopes] };
};

void sql;
