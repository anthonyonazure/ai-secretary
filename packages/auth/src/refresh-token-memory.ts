/**
 * In-memory `RefreshTokenStore` for tests + dev.
 *
 * Mirrors the Redis backend's contract:
 *   - save → per-token expiry honored at `lookup` time
 *   - rotate → atomically deletes the old token and writes the new one
 *   - revoke / revokeAllForUser → drops matching tokens
 *
 * Not suitable for production: state is per-process and lost on
 * restart.
 */

import type {
  RefreshTokenRotateInput,
  RefreshTokenSaveInput,
  RefreshTokenStore,
} from './refresh-token.js';
import type { RefreshTokenRecord } from './types.js';

interface Entry {
  userId: string;
  tenantId: string;
  expiresAt: Date;
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly entries = new Map<string, Entry>();

  async save(record: RefreshTokenSaveInput): Promise<void> {
    this.entries.set(record.token, {
      userId: record.userId,
      tenantId: record.tenantId,
      expiresAt: record.expiresAt,
    });
  }

  async lookup(token: string): Promise<RefreshTokenRecord | null> {
    const entry = this.entries.get(token);
    if (!entry) return null;
    if (entry.expiresAt.getTime() <= Date.now()) {
      this.entries.delete(token);
      return null;
    }
    return {
      token,
      userId: entry.userId,
      tenantId: entry.tenantId,
      expiresAt: entry.expiresAt,
    };
  }

  async rotate(
    oldToken: string,
    newRecord: RefreshTokenRotateInput,
  ): Promise<RefreshTokenRecord | null> {
    const existing = await this.lookup(oldToken);
    if (!existing) return null;
    this.entries.delete(oldToken);
    this.entries.set(newRecord.token, {
      userId: existing.userId,
      tenantId: existing.tenantId,
      expiresAt: newRecord.expiresAt,
    });
    return existing;
  }

  async revoke(token: string): Promise<void> {
    this.entries.delete(token);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [token, entry] of this.entries.entries()) {
      if (entry.userId === userId) this.entries.delete(token);
    }
  }
}
