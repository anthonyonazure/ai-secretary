/**
 * Repository seam for the auth routes.
 *
 * Production wiring goes through Drizzle against the `users` + `tenants`
 * tables. Tests inject an in-memory implementation that mirrors the
 * contract — this keeps the route handler testable without a live
 * Postgres process.
 *
 * The repository is the only place that knows about DB row shapes; the
 * route layer works in plain TS objects.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { tenants, users } from '@aisecretary/db/schema';
import type { UserRole } from '@aisecretary/shared';
import { and, eq, sql } from 'drizzle-orm';

export interface AuthUserRow {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string | null;
  isMfaEnabled: boolean;
}

export interface AuthTenantRow {
  id: string;
  name: string;
  slug: string;
  region: Region;
  /** Story 1.5c — org-wide MFA enforcement flag. */
  mfaRequired: boolean;
}

/** Story 1.5c — full MFA-state slice for a user. */
export interface UserMfaState {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  region: Region;
  passwordHash: string | null;
  isMfaEnabled: boolean;
  mfaPending: boolean;
  mfaSecretEncrypted: string | null;
  recoveryCodeHashes: string[];
}

export interface MfaEnrollmentInput {
  encryptedSecret: string;
  recoveryCodeHashes: string[];
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  region: Region;
}

export interface CreateUserInput {
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

export interface AuthRepository {
  /** Look up the user by email across all tenants (signup uniqueness check). */
  findUserByEmail(email: string): Promise<AuthUserRow | null>;
  /** Look up a user by id (for /me). */
  findUserById(userId: string): Promise<AuthUserRow | null>;
  /** Look up a tenant by id (for /me to surface region + name). */
  findTenantById(tenantId: string): Promise<AuthTenantRow | null>;
  /** Create a tenant. Returns the created row. */
  createTenant(input: CreateTenantInput): Promise<AuthTenantRow>;
  /** Create a user. Returns the created row. */
  createUser(input: CreateUserInput): Promise<AuthUserRow>;
  /** Update `users.last_login_at` to now. Best-effort; failures are logged not thrown. */
  touchLastLogin(userId: string, tenantId: string, region: Region): Promise<void>;
  /* ------------------------------------------------------------------ */
  /* Story 1.5c — MFA repo extensions.                                   */
  /* ------------------------------------------------------------------ */
  /** Read full MFA state for a user (used by enroll / confirm / verify). */
  findUserByIdForMfa(userId: string, tenantId: string): Promise<UserMfaState | null>;
  /** Persist a freshly minted enrollment (sets `mfa_pending=true`). */
  setMfaEnrollment(userId: string, tenantId: string, input: MfaEnrollmentInput): Promise<void>;
  /** Flip `mfa_pending=false` + `is_mfa_enabled=true`. */
  confirmMfaEnrollment(userId: string, tenantId: string): Promise<void>;
  /** Disable MFA: clears secret + hashes, flips both flags off. */
  disableMfa(userId: string, tenantId: string): Promise<void>;
  /** Atomically remove a recovery-code hash. Returns true if the hash was present. */
  consumeRecoveryCode(userId: string, tenantId: string, codeHash: string): Promise<boolean>;
}

const slugify = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
};

/** Generate a candidate slug; uniqueness is enforced by a DB constraint. */
export const tenantSlugFromName = (name: string): string => {
  const base = slugify(name);
  const fallback = base.length > 0 ? base : 'tenant';
  // Add a short random suffix so two tenants with the same name don't collide.
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${fallback}-${suffix}`;
};

/**
 * Drizzle-backed repository. Lookups run outside `withTenantContext`
 * because signup needs to check email uniqueness across tenants.
 * Inserts that target tenant-scoped tables wrap with the appropriate
 * tenant context.
 */
export class DrizzleAuthRepository implements AuthRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    const rows = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
        isMfaEnabled: users.isMfaEnabled,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async findUserById(userId: string): Promise<AuthUserRow | null> {
    const rows = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
        isMfaEnabled: users.isMfaEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findTenantById(tenantId: string): Promise<AuthTenantRow | null> {
    const rows = await this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        region: tenants.region,
        mfaRequired: tenants.mfaRequired,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return rows[0] ?? null;
  }

  async createTenant(input: CreateTenantInput): Promise<AuthTenantRow> {
    // Tenant inserts don't run inside `withTenantContext` because the
    // tenant doesn't exist yet — RLS settings would point at a missing
    // row. The `tenants` table itself has no RLS (it's the root).
    const rows = await this.db
      .insert(tenants)
      .values({
        name: input.name,
        slug: input.slug,
        region: input.region,
      })
      .returning({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        region: tenants.region,
        mfaRequired: tenants.mfaRequired,
      });
    const row = rows[0];
    if (!row) {
      throw new Error('createTenant: insert returned no rows');
    }
    return row;
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
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
        const row = rows[0];
        if (!row) {
          throw new Error('createUser: insert returned no rows');
        }
        return row;
      },
    );
  }

  async touchLastLogin(userId: string, tenantId: string, region: Region): Promise<void> {
    await withTenantContext(this.db, { tenantId, region }, async (tx) => {
      await tx
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    });
  }

  async findUserByIdForMfa(userId: string, tenantId: string): Promise<UserMfaState | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select({
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          role: users.role,
          passwordHash: users.passwordHash,
          isMfaEnabled: users.isMfaEnabled,
          mfaPending: users.mfaPending,
          mfaSecretEncrypted: users.mfaSecretEncrypted,
          recoveryCodeHashes: users.recoveryCodeHashes,
        })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        ...row,
        region: this.region,
        recoveryCodeHashes: row.recoveryCodeHashes ?? [],
      } as UserMfaState;
    });
  }

  async setMfaEnrollment(
    userId: string,
    tenantId: string,
    input: MfaEnrollmentInput,
  ): Promise<void> {
    await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      await tx
        .update(users)
        .set({
          mfaSecretEncrypted: input.encryptedSecret,
          recoveryCodeHashes: input.recoveryCodeHashes,
          mfaPending: true,
          isMfaEnabled: false,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    });
  }

  async confirmMfaEnrollment(userId: string, tenantId: string): Promise<void> {
    await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      await tx
        .update(users)
        .set({
          mfaPending: false,
          isMfaEnabled: true,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    });
  }

  async disableMfa(userId: string, tenantId: string): Promise<void> {
    await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      await tx
        .update(users)
        .set({
          isMfaEnabled: false,
          mfaPending: false,
          mfaSecretEncrypted: null,
          recoveryCodeHashes: [],
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    });
  }

  async consumeRecoveryCode(userId: string, tenantId: string, codeHash: string): Promise<boolean> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      // Atomic check-and-remove: only update rows where the hash is present
      // in the array. Drizzle's array_remove leaves the array unchanged when
      // the element is missing — so we use a guarded WHERE with array
      // containment.
      const result = await tx
        .update(users)
        .set({
          recoveryCodeHashes: sql`array_remove(${users.recoveryCodeHashes}, ${codeHash})`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, userId),
            eq(users.tenantId, tenantId),
            sql`${codeHash} = ANY(${users.recoveryCodeHashes})`,
          ),
        )
        .returning({ id: users.id });
      return result.length > 0;
    });
  }
}
