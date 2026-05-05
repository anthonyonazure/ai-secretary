/**
 * Redis-backed `HeartbeatPublisher` — production impl of the bot
 * heartbeat seam declared in `./heartbeat-publisher.ts`.
 *
 * Republishes the watchdog key (`heartbeat:bot:<sessionId>`) every
 * `intervalMs` with `ttlSeconds` TTL. The cross-tenant `bot-watchdog`
 * worker scan (`apps/workers/src/handlers/bot-watchdog.ts`) reads the
 * same keys and enqueues a `bot-join-failed` notification on loss.
 */

import type Redis from 'ioredis';
import type pino from 'pino';

import type {
  HeartbeatPublisher,
  HeartbeatPublisherHandle,
  HeartbeatPublisherStartInput,
} from './heartbeat-publisher.js';

export interface RedisHeartbeatPublisherOptions {
  redis: Redis;
  logger: pino.Logger;
}

export class RedisHeartbeatPublisher implements HeartbeatPublisher {
  constructor(private readonly options: RedisHeartbeatPublisherOptions) {}

  start(input: HeartbeatPublisherStartInput): HeartbeatPublisherHandle {
    const { key, intervalMs, ttlSeconds } = input;
    const redis = this.options.redis;
    const logger = this.options.logger;

    let stopped = false;
    const tick = async (): Promise<void> => {
      if (stopped) return;
      try {
        await redis.set(key, '1', 'EX', ttlSeconds);
      } catch (err) {
        logger.warn({ err, key }, 'bot: heartbeat publish failed (will retry next tick)');
      }
    };

    // Fire one immediately so the watchdog sees the session within its
    // 15s scan window even if interval is 30s.
    void tick();
    const timer = setInterval(() => {
      void tick();
    }, intervalMs);

    return {
      async stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        try {
          await redis.del(key);
        } catch {
          // Best-effort — TTL will reap the key regardless.
        }
      },
    };
  }
}
