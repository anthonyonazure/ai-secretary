/**
 * Heartbeat publisher — abstracts over the Redis SETEX cadence the
 * `apps/workers/src/handlers/bot-watchdog.ts` handler watches.
 *
 * Contract:
 *   - SETEX key=`heartbeat:bot:<sessionId>` value=`'1'` ttl=`90s`
 *   - Re-fired every 30s while the session is in-flight
 *   - When `stop()` is called the interval clears and no further
 *     publishes happen (the key naturally expires after the TTL)
 *
 * Tests use `InMemoryHeartbeatPublisher` to assert the publish cadence
 * without booting Redis. Production wires the Redis-backed implementation
 * in `apps/bot/src/index.ts` next to the pg-boss boot.
 */

export interface HeartbeatPublisherStartInput {
  key: string;
  intervalMs: number;
  ttlSeconds: number;
}

export interface HeartbeatPublisherHandle {
  /** Idempotent. Stops the interval; the key expires naturally. */
  stop(): Promise<void>;
}

export interface HeartbeatPublisher {
  start(input: HeartbeatPublisherStartInput): HeartbeatPublisherHandle;
}

/**
 * In-memory publisher for tests. Records every publish into `pulses`
 * keyed by the watchdog key. Tests can advance fake timers and assert
 * the right number of pulses.
 */
export class InMemoryHeartbeatPublisher implements HeartbeatPublisher {
  public readonly pulses = new Map<string, number[]>();
  public readonly stops: string[] = [];

  start(input: HeartbeatPublisherStartInput): HeartbeatPublisherHandle {
    const { key, intervalMs } = input;
    const list = this.pulses.get(key) ?? [];
    list.push(Date.now());
    this.pulses.set(key, list);

    const timer = setInterval(() => {
      const stored = this.pulses.get(key) ?? [];
      stored.push(Date.now());
      this.pulses.set(key, stored);
    }, intervalMs);

    let stopped = false;
    const publisher = this;
    return {
      async stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        publisher.stops.push(key);
      },
    };
  }
}
