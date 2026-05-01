/**
 * Repository seam for the invites routes (Story 1.5d).
 *
 * Production wires Drizzle against `tenant_invites` + `users` + `tenants`;
 * tests inject `InMemoryInvitesRepository`. Mirrors the auth + feedback
 * repositories — the route layer never imports Drizzle.
 *
 * RLS notes (matches packages/db/rls/0009_rls_tenant_invites.sql):
 *   - Admin-flow methods (`create`, `list`, `revoke`) run inside
 *     `withTenantContext` — the strict in-tenant policy applies.
 *   - The unauthenticated `findByTokenHash` runs OUTSIDE
 *     `withTenantContext` (the recipient has no tenant binding yet).
 *     The transaction sets `app.invite_token_lookup = 'allow'` so the
 *     bypass policy permits the SELECT, then unsets it on commit.
 *   - `markAccepted` runs inside `withTenantContext` once the new user
 *     row has been minted (which establishes the tenant id).
 *
 * The repository is also responsible for the cross-table
 * `findByTokenHash` join (invite + tenant + inviter user), since
 * those rows live behind different RLS policies in production.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { tenantInvites, tenants, users } from '@aisecretary/db/schema';
import type { UserRole } from '@aisecretary/shared';
import { and, count, desc, eq, sql } from 'drizzle-orm';

export interface InviteRow {
  id: string;
  tenantId: string;
  invitedByUserId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  createdAt: Date;
}

export interface InviteWithJoinsRow {
  invite: InviteRow;
  tenant: { id: string; name: string; region: Region };
  inviter: { id: string; name: string; email: string };
}

export interface CreateInviteInput {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Thrown by `create` when the unique-`(tenant_id, email)` constraint
 * trips (open invite already exists for that recipient).
 */
export class InviteEmailConflictError extends Error {
  constructor(message = 'An open invite already exists for this email.') {
    super(message);
    this.name = 'InviteEmailConflictError';
  }
}

export interface AcceptInviteInput {
  inviteId: string;
  tenantId: string;
  region: Region;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface AcceptInviteResult {
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: UserRole;
    passwordHash: string;
    isMfaEnabled: boolean;
  };
}

export interface InvitesRepository {
  /** Insert a new invite. Throws `InviteEmailConflictError` on duplicate. */
  create(input: CreateInviteInput): Promise<InviteRow>;
  /** List all invites for a tenant, newest first, with inviter join. */
  list(tenantId: string): Promise<{ items: InviteWithJoinsRow[]; totalCount: number }>;
  /** Find a single invite by id (used by revoke). */
  findById(inviteId: string, tenantId: string): Promise<InviteRow | null>;
  /** Mark an invite revoked. Returns null if not found. */
  revoke(inviteId: string, tenantId: string, revokedByUserId: string): Promise<InviteRow | null>;
  /**
   * Public lookup — runs outside tenant context (the recipient is
   * unauthenticated). Returns invite + tenant + inviter joins, or null
   * when the token doesn't resolve. Implementations are responsible
   * for setting `app.invite_token_lookup = 'allow'` on the lookup
   * transaction so the RLS bypass policy permits the SELECT.
   */
  findByTokenHash(tokenHash: string): Promise<InviteWithJoinsRow | null>;
  /**
   * Accept an invite: create the user row + mark the invite consumed
   * inside a single tenant-scoped transaction. Throws if the user-row
   * insert collides on email (caller should have checked uniqueness).
   */
  acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult>;
}

const isUniqueViolation = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  return (err as { code?: string }).code === '23505';
};

/**
 * Drizzle-backed repository. Production. Lookups by token_hash
 * deliberately bypass `withTenantContext` (the recipient is
 * unauthenticated); see the RLS file for the policy that gates this.
 */
export class DrizzleInvitesRepository implements InvitesRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async create(input: CreateInviteInput): Promise<InviteRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        try {
          const rows = await tx
            .insert(tenantInvites)
            .values({
              tenantId: input.tenantId,
              invitedByUserId: input.invitedByUserId,
              email: input.email.toLowerCase(),
              role: input.role,
              tokenHash: input.tokenHash,
              expiresAt: input.expiresAt,
            })
            .returning();
          const row = rows[0];
          if (!row) {
            throw new Error('createInvite: insert returned no rows');
          }
          return mapInviteRow(row);
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new InviteEmailConflictError();
          }
          throw err;
        }
      },
    );
  }

  async list(tenantId: string): Promise<{ items: InviteWithJoinsRow[]; totalCount: number }> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select({
          invite: tenantInvites,
          tenant: { id: tenants.id, name: tenants.name, region: tenants.region },
          inviter: { id: users.id, name: users.name, email: users.email },
        })
        .from(tenantInvites)
        .innerJoin(tenants, eq(tenantInvites.tenantId, tenants.id))
        .innerJoin(users, eq(tenantInvites.invitedByUserId, users.id))
        .where(eq(tenantInvites.tenantId, tenantId))
        .orderBy(desc(tenantInvites.createdAt));
      const totalRows = await tx
        .select({ value: count() })
        .from(tenantInvites)
        .where(eq(tenantInvites.tenantId, tenantId));
      const totalCount = Number(totalRows[0]?.value ?? rows.length);
      return {
        items: rows.map((r) => ({
          invite: mapInviteRow(r.invite),
          tenant: { id: r.tenant.id, name: r.tenant.name, region: r.tenant.region },
          inviter: { id: r.inviter.id, name: r.inviter.name, email: r.inviter.email },
        })),
        totalCount,
      };
    });
  }

  async findById(inviteId: string, tenantId: string): Promise<InviteRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantInvites)
        .where(and(eq(tenantInvites.id, inviteId), eq(tenantInvites.tenantId, tenantId)))
        .limit(1);
      return rows[0] ? mapInviteRow(rows[0]) : null;
    });
  }

  async revoke(
    inviteId: string,
    tenantId: string,
    revokedByUserId: string,
  ): Promise<InviteRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .update(tenantInvites)
        .set({ revokedAt: new Date(), revokedByUserId })
        .where(and(eq(tenantInvites.id, inviteId), eq(tenantInvites.tenantId, tenantId)))
        .returning();
      return rows[0] ? mapInviteRow(rows[0]) : null;
    });
  }

  async findByTokenHash(tokenHash: string): Promise<InviteWithJoinsRow | null> {
    // Public path: no tenant context. We open a transaction ourselves
    // and set `app.invite_token_lookup = 'allow'` so the RLS bypass
    // policy permits the SELECT. The setting is local to the
    // transaction (set_config third arg `true`), so it auto-clears at
    // commit/rollback.
    return await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.invite_token_lookup', 'allow', true)`);
      const rows = await tx
        .select({
          invite: tenantInvites,
          tenant: { id: tenants.id, name: tenants.name, region: tenants.region },
          inviter: { id: users.id, name: users.name, email: users.email },
        })
        .from(tenantInvites)
        .innerJoin(tenants, eq(tenantInvites.tenantId, tenants.id))
        .innerJoin(users, eq(tenantInvites.invitedByUserId, users.id))
        .where(eq(tenantInvites.tokenHash, tokenHash))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        invite: mapInviteRow(row.invite),
        tenant: { id: row.tenant.id, name: row.tenant.name, region: row.tenant.region },
        inviter: {
          id: row.inviter.id,
          name: row.inviter.name,
          email: row.inviter.email,
        },
      };
    });
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: input.region },
      async (tx) => {
        const userRows = await tx
          .insert(users)
          .values({
            tenantId: input.tenantId,
            email: input.email.toLowerCase(),
            name: input.name,
            role: input.role,
            passwordHash: input.passwordHash,
          })
          .returning({
            id: users.id,
            tenantId: users.tenantId,
            email: users.email,
            name: users.name,
            role: users.role,
            passwordHash: users.passwordHash,
            isMfaEnabled: users.isMfaEnabled,
          });
        const userRow = userRows[0];
        if (!userRow) {
          throw new Error('acceptInvite: user insert returned no rows');
        }
        await tx
          .update(tenantInvites)
          .set({ acceptedAt: new Date(), acceptedByUserId: userRow.id })
          .where(
            and(eq(tenantInvites.id, input.inviteId), eq(tenantInvites.tenantId, input.tenantId)),
          );
        return {
          user: {
            id: userRow.id,
            tenantId: userRow.tenantId,
            email: userRow.email,
            name: userRow.name,
            role: userRow.role,
            passwordHash: userRow.passwordHash ?? '',
            isMfaEnabled: userRow.isMfaEnabled,
          },
        };
      },
    );
  }
}

const mapInviteRow = (row: typeof tenantInvites.$inferSelect): InviteRow => ({
  id: row.id,
  tenantId: row.tenantId,
  invitedByUserId: row.invitedByUserId,
  email: row.email,
  role: row.role as UserRole,
  tokenHash: row.tokenHash,
  expiresAt: row.expiresAt,
  acceptedAt: row.acceptedAt ?? null,
  acceptedByUserId: row.acceptedByUserId ?? null,
  revokedAt: row.revokedAt ?? null,
  revokedByUserId: row.revokedByUserId ?? null,
  createdAt: row.createdAt,
});

/**
 * In-memory invites repository for tests. Mirrors the Drizzle behavior
 * including the unique-`(tenantId, email)` constraint. Cross-table
 * joins (`tenant`, `inviter`) are resolved against caller-provided
 * fixtures registered via `seedTenant` + `seedUser` so test setup
 * doesn't leak Drizzle types.
 */
export class InMemoryInvitesRepository implements InvitesRepository {
  public readonly invites: InviteRow[] = [];
  public readonly tenantsById = new Map<string, { id: string; name: string; region: Region }>();
  public readonly usersById = new Map<
    string,
    { id: string; name: string; email: string; tenantId: string }
  >();

  /** Test helper — register a fake tenant for the repo's join lookups. */
  seedTenant(t: { id: string; name: string; region: Region }): void {
    this.tenantsById.set(t.id, t);
  }

  /** Test helper — register a fake inviter user. */
  seedUser(u: { id: string; name: string; email: string; tenantId: string }): void {
    this.usersById.set(u.id, u);
  }

  async create(input: CreateInviteInput): Promise<InviteRow> {
    const conflict = this.invites.find(
      (r) =>
        r.tenantId === input.tenantId &&
        r.email === input.email.toLowerCase() &&
        r.acceptedAt === null &&
        r.revokedAt === null,
    );
    if (conflict) {
      throw new InviteEmailConflictError();
    }
    const row: InviteRow = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      invitedByUserId: input.invitedByUserId,
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      revokedByUserId: null,
      createdAt: new Date(),
    };
    this.invites.push(row);
    return row;
  }

  async list(tenantId: string): Promise<{ items: InviteWithJoinsRow[]; totalCount: number }> {
    const rows = this.invites
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items: InviteWithJoinsRow[] = [];
    for (const invite of rows) {
      const tenant = this.tenantsById.get(invite.tenantId);
      const inviter = this.usersById.get(invite.invitedByUserId);
      if (!tenant || !inviter) continue;
      items.push({
        invite,
        tenant,
        inviter: { id: inviter.id, name: inviter.name, email: inviter.email },
      });
    }
    return { items, totalCount: rows.length };
  }

  async findById(inviteId: string, tenantId: string): Promise<InviteRow | null> {
    return this.invites.find((r) => r.id === inviteId && r.tenantId === tenantId) ?? null;
  }

  async revoke(
    inviteId: string,
    tenantId: string,
    revokedByUserId: string,
  ): Promise<InviteRow | null> {
    const idx = this.invites.findIndex((r) => r.id === inviteId && r.tenantId === tenantId);
    if (idx === -1) return null;
    const existing = this.invites[idx];
    if (!existing) return null;
    const row: InviteRow = {
      ...existing,
      revokedAt: new Date(),
      revokedByUserId,
    };
    this.invites[idx] = row;
    return row;
  }

  async findByTokenHash(tokenHash: string): Promise<InviteWithJoinsRow | null> {
    const invite = this.invites.find((r) => r.tokenHash === tokenHash);
    if (!invite) return null;
    const tenant = this.tenantsById.get(invite.tenantId);
    const inviter = this.usersById.get(invite.invitedByUserId);
    if (!tenant || !inviter) return null;
    return {
      invite,
      tenant,
      inviter: { id: inviter.id, name: inviter.name, email: inviter.email },
    };
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    const idx = this.invites.findIndex((r) => r.id === input.inviteId);
    if (idx === -1) {
      throw new Error('acceptInvite: invite not found');
    }
    const userId = crypto.randomUUID();
    this.usersById.set(userId, {
      id: userId,
      name: input.name,
      email: input.email.toLowerCase(),
      tenantId: input.tenantId,
    });
    const existing = this.invites[idx];
    if (existing) {
      this.invites[idx] = {
        ...existing,
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      };
    }
    return {
      user: {
        id: userId,
        tenantId: input.tenantId,
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
        isMfaEnabled: false,
      },
    };
  }
}
