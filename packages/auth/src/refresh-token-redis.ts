/**
 * Redis-backed `RefreshTokenStore`.
 *
 * Storage layout (one key per token):
 *
 *   refresh:<token>  →  JSON { userId, tenantId, expiresAt }   EX <ttl>
 *
 * Plus a per-user set for `revokeAllForUser`:
 *
 *   refresh-user:<userId>  →  SET of tokens
 *
 * ## Rotation semantics
 *
 * Rotation runs as a Redis MULTI/EXEC pipeline:
 *
 *   1. GET refresh:<old>           — read the old record (outside the txn)
 *   2. MULTI
 *      DEL refresh:<old>
 *      SREM refresh-user:<uid> <old>
 *      SET refresh:<new> {...} EX <ttl>
 *      SADD refresh-user:<uid> <new>
 *      EXEC
 *
 * If the GET returns nothing, rotate() returns `null` without queueing
 * the EXEC — that's the unknown/revoked-token path that the route
 * handler converts to 401.
 *
 * The MULTI/EXEC is what gives us the atomicity we want for
 * rotation-on-use: a refresh request can't end up with both the old
 * and new tokens valid (or, worse, neither valid).
 */

import type Redis from 'ioredis';
import type {
  RefreshTokenRotateInput,
  RefreshTokenSaveInput,
  RefreshTokenStore,
} from './refresh-token.js';
import type { RefreshTokenRecord } from './types.js';

interface StoredPayload {
  userId: string;
  tenantId: string;
  expiresAt: string; // ISO 8601
}

const KEY_PREFIX = 'refresh:';
const USER_INDEX_PREFIX = 'refresh-user:';

const tokenKey = (token: string): string => `${KEY_PREFIX}${token}`;
const userIndexKey = (userId: string): string => `${USER_INDEX_PREFIX}${userId}`;

const ttlSecondsFrom = (expiresAt: Date, now: Date = new Date()): number => {
  const seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  return seconds > 0 ? seconds : 1;
};

const parsePayload = (raw: string | null): StoredPayload | null => {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredPayload>;
    if (
      typeof obj.userId === 'string' &&
      typeof obj.tenantId === 'string' &&
      typeof obj.expiresAt === 'string'
    ) {
      return obj as StoredPayload;
    }
    return null;
  } catch {
    return null;
  }
};

const toRecord = (token: string, payload: StoredPayload): RefreshTokenRecord => ({
  token,
  userId: payload.userId,
  tenantId: payload.tenantId,
  expiresAt: new Date(payload.expiresAt),
});

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: Redis) {}

  async save(record: RefreshTokenSaveInput): Promise<void> {
    const payload: StoredPayload = {
      userId: record.userId,
      tenantId: record.tenantId,
      expiresAt: record.expiresAt.toISOString(),
    };
    const ttl = ttlSecondsFrom(record.expiresAt);
    await this.redis
      .multi()
      .set(tokenKey(record.token), JSON.stringify(payload), 'EX', ttl)
      .sadd(userIndexKey(record.userId), record.token)
      .expire(userIndexKey(record.userId), ttl)
      .exec();
  }

  async lookup(token: string): Promise<RefreshTokenRecord | null> {
    const raw = await this.redis.get(tokenKey(token));
    const payload = parsePayload(raw);
    return payload ? toRecord(token, payload) : null;
  }

  async rotate(
    oldToken: string,
    newRecord: RefreshTokenRotateInput,
  ): Promise<RefreshTokenRecord | null> {
    const raw = await this.redis.get(tokenKey(oldToken));
    const payload = parsePayload(raw);
    if (!payload) return null;

    const newPayload: StoredPayload = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      expiresAt: newRecord.expiresAt.toISOString(),
    };
    const ttl = ttlSecondsFrom(newRecord.expiresAt);

    const result = await this.redis
      .multi()
      .del(tokenKey(oldToken))
      .srem(userIndexKey(payload.userId), oldToken)
      .set(tokenKey(newRecord.token), JSON.stringify(newPayload), 'EX', ttl)
      .sadd(userIndexKey(payload.userId), newRecord.token)
      .expire(userIndexKey(payload.userId), ttl)
      .exec();

    // If MULTI/EXEC was aborted (null), surface as unknown-token.
    if (!result) return null;
    return toRecord(oldToken, payload);
  }

  async revoke(token: string): Promise<void> {
    const raw = await this.redis.get(tokenKey(token));
    const payload = parsePayload(raw);
    const pipeline = this.redis.multi().del(tokenKey(token));
    if (payload) {
      pipeline.srem(userIndexKey(payload.userId), token);
    }
    await pipeline.exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const tokens = await this.redis.smembers(userIndexKey(userId));
    if (tokens.length === 0) return;
    const pipeline = this.redis.multi();
    for (const token of tokens) {
      pipeline.del(tokenKey(token));
    }
    pipeline.del(userIndexKey(userId));
    await pipeline.exec();
  }
}
