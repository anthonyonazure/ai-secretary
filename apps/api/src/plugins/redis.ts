/**
 * `redis` plugin — decorates `fastify.redis` with an ioredis client and
 * `fastify.heartbeatStore` with a small key/value interface used by
 * Stories 4.4 / 9.6.
 *
 * Heartbeat protocol (arch-addendums § 5):
 *   - Client emits `POST /heartbeat` every 30s.
 *   - Server SETEX `heartbeat:<recordingId>` = "1" with TTL 90s.
 *   - Watchdog (workers) scans every 15s; missing key → enqueue
 *     `notification.send` with `kind=capture-at-risk` (push within 60s).
 *
 * Implementation notes:
 *
 *   - Production wires Redis via `env.REDIS_URL`. Tests / dev that don't
 *     set that fall through to an `InMemoryHeartbeatStore` so unit tests
 *     don't have to boot Redis.
 *   - The Fastify decoration is the small `HeartbeatStore` interface —
 *     not the raw ioredis client — so consumers don't grow direct
 *     dependencies on the Redis client API. This keeps the heartbeat
 *     surface portable when (eventually) we swap the substrate.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type Redis from 'ioredis';

/**
 * Small wrapper around the heartbeat key store. Production uses Redis
 * (TTL-aware); tests use an in-memory fallback.
 */
export interface HeartbeatStore {
  /** Mark a recording's heartbeat as fresh; expires after `ttlSeconds`. */
  setHeartbeat(recordingId: string, ttlSeconds: number): Promise<void>;
  /**
   * Returns true if the heartbeat key for `recordingId` is missing
   * (TTL elapsed or never set). Used by the watchdog.
   */
  isHeartbeatLost(recordingId: string): Promise<boolean>;
  /**
   * Marks "watchdog has fired for this recording within the dedup
   * window" so the same notification isn't enqueued twice. TTL controls
   * the window length (5 min = 300s per arch-addendums § 5).
   */
  markWatchdogFired(recordingId: string, ttlSeconds: number): Promise<void>;
  /** Returns true if `markWatchdogFired` was called within its TTL. */
  hasWatchdogFired(recordingId: string): Promise<boolean>;
}

/**
 * In-memory implementation of `HeartbeatStore`. Used by tests + dev
 * when `REDIS_URL` is unset. Honours TTL via stored expiry timestamps.
 *
 * Thread-safety: Node single-thread per process — fine. Multi-process
 * deployments MUST configure Redis (otherwise heartbeat state desyncs
 * across instances).
 */
export class InMemoryHeartbeatStore implements HeartbeatStore {
  private readonly heartbeats = new Map<string, number>();
  private readonly fired = new Map<string, number>();

  private isAlive(map: Map<string, number>, key: string): boolean {
    const expiresAt = map.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      map.delete(key);
      return false;
    }
    return true;
  }

  async setHeartbeat(recordingId: string, ttlSeconds: number): Promise<void> {
    this.heartbeats.set(recordingId, Date.now() + ttlSeconds * 1000);
  }

  async isHeartbeatLost(recordingId: string): Promise<boolean> {
    return !this.isAlive(this.heartbeats, recordingId);
  }

  async markWatchdogFired(recordingId: string, ttlSeconds: number): Promise<void> {
    this.fired.set(recordingId, Date.now() + ttlSeconds * 1000);
  }

  async hasWatchdogFired(recordingId: string): Promise<boolean> {
    return this.isAlive(this.fired, recordingId);
  }

  /** Test-only — drop all in-memory state. */
  __reset(): void {
    this.heartbeats.clear();
    this.fired.clear();
  }
}

/**
 * Redis-backed implementation. Single-key SETEX semantics for the
 * heartbeat; SETEX with `EX` for the watchdog-fired marker.
 */
export class RedisHeartbeatStore implements HeartbeatStore {
  constructor(private readonly redis: Redis) {}

  private heartbeatKey(recordingId: string): string {
    return `heartbeat:${recordingId}`;
  }

  private firedKey(recordingId: string): string {
    return `watchdog-fired:${recordingId}`;
  }

  async setHeartbeat(recordingId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.heartbeatKey(recordingId), '1', 'EX', ttlSeconds);
  }

  async isHeartbeatLost(recordingId: string): Promise<boolean> {
    const value = await this.redis.get(this.heartbeatKey(recordingId));
    return value === null;
  }

  async markWatchdogFired(recordingId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.firedKey(recordingId), '1', 'EX', ttlSeconds);
  }

  async hasWatchdogFired(recordingId: string): Promise<boolean> {
    const value = await this.redis.get(this.firedKey(recordingId));
    return value !== null;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Optional ioredis instance — present only when REDIS_URL was set. */
    redis: Redis | null;
    /**
     * Heartbeat store. Always present. Backed by Redis when `redis` is
     * non-null; otherwise the in-memory fallback.
     */
    heartbeatStore: HeartbeatStore;
  }
}

export interface RedisPluginOptions {
  /**
   * Pre-built ioredis client (production) or null (tests / dev fallback).
   * The plugin owns close on Fastify `onClose` when one is supplied.
   */
  redis?: Redis | null;
  /**
   * Override the heartbeat store directly (tests). When provided, the
   * `redis` option is ignored for store wiring.
   */
  heartbeatStore?: HeartbeatStore;
}

const plugin: FastifyPluginAsync<RedisPluginOptions> = async (
  fastify: FastifyInstance,
  options: RedisPluginOptions,
) => {
  const redis = options.redis ?? null;
  const store: HeartbeatStore =
    options.heartbeatStore ??
    (redis ? new RedisHeartbeatStore(redis) : new InMemoryHeartbeatStore());

  fastify.decorate('redis', redis);
  fastify.decorate('heartbeatStore', store);

  if (redis && !options.heartbeatStore) {
    // Only manage close lifecycle when WE own the connection (i.e. it
    // wasn't injected just for the store). The server's refresh-token
    // path manages its own ioredis instance separately.
    fastify.addHook('onClose', async () => {
      await redis.quit().catch(() => {
        // ioredis sometimes throws on already-closed connections; safe to ignore.
      });
    });
  }
};

export const redisPlugin = fp(plugin, {
  name: 'redis',
});
