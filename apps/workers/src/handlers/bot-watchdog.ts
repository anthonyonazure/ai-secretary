/**
 * `bot-watchdog` queue handler — Story 9.6.
 *
 * Mirrors the recording watchdog (Story 4.4) but for bot sessions.
 * Cadence:
 *   - `apps/bot` posts a heartbeat every 30s.
 *   - Server SETEX `heartbeat:bot:<sessionId>` with TTL 90s.
 *   - This watchdog runs every 15s. For each in-flight bot session
 *     (status ∈ provisioning | joined AND started_at within 24h), we
 *     check the Redis key. Missing = lost ping → enqueue
 *     `notification.send` with `kind: 'bot-join-failed'`.
 *   - `watchdog-fired:bot:<sessionId>` (TTL 5min) suppresses dupes.
 *
 * Push delivery target: ≤60s after lost ping.
 *
 * The bot-side service (`apps/bot`) is not yet built (Stories 9.3-9.5
 * blocked on Zoom S2S OAuth + Teams Graph credentials). This watchdog
 * is the receive-side substrate that's ready to consume their
 * heartbeats once the service ships.
 */

import type { Logger } from 'pino';

import type { WatchdogHeartbeatStore } from './recording-watchdog.js';

export interface InFlightBotSession {
  tenantId: string;
  sessionId: string;
  ownerUserId: string;
  meetingId: string | null;
  region: 'us' | 'eu';
  /** Source platform — drives the notification copy ("Zoom" vs "Teams"). */
  source: 'zoom_bot' | 'teams_bot';
}

export interface BotWatchdogReader {
  listInFlight(args: { sinceMs: number }): Promise<InFlightBotSession[]>;
}

export interface BotNotificationEnqueuer {
  enqueueBotJoinFailed(input: {
    tenantId: string;
    sessionId: string;
    ownerUserId: string;
    meetingId: string | null;
    source: 'zoom_bot' | 'teams_bot';
    dedupKey: string;
  }): Promise<void>;
}

export interface BotWatchdogDeps {
  reader: BotWatchdogReader;
  heartbeatStore: WatchdogHeartbeatStore;
  notificationEnqueuer: BotNotificationEnqueuer;
  logger: Logger;
  /** Test seam for deterministic timestamps. */
  now?: () => number;
}

export const BOT_WATCHDOG_QUEUE = 'bot-watchdog';
/** Once every 15 seconds (cron with seconds-precision). */
export const BOT_WATCHDOG_CRON = '*/15 * * * * *' as const;
/** Lookback for in-flight bot sessions. */
export const BOT_WATCHDOG_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Dedup window — same as packages/notifications DEDUP_WINDOW_MS. */
export const BOT_WATCHDOG_DEDUP_WINDOW_MS = 5 * 60 * 1000;

export const runBotWatchdog = async (
  deps: BotWatchdogDeps,
): Promise<{ scanned: number; enqueued: number; suppressed: number }> => {
  const now = deps.now ?? Date.now;
  const sinceMs = now() - BOT_WATCHDOG_LOOKBACK_MS;
  const rows = await deps.reader.listInFlight({ sinceMs });

  let enqueued = 0;
  let suppressed = 0;

  for (const row of rows) {
    // Bot heartbeats use the same Redis store; the prefix discrimination
    // happens at the API plugin's heartbeat-store wrapper. The watchdog
    // therefore reads the prefixed key transparently — the store
    // accepts a `'bot:<sessionId>'` form.
    const heartbeatKey = `bot:${row.sessionId}`;
    const lost = await deps.heartbeatStore.isHeartbeatLost(heartbeatKey);
    if (!lost) continue;

    const alreadyFired = await deps.heartbeatStore.hasWatchdogFired(heartbeatKey);
    if (alreadyFired) {
      suppressed += 1;
      continue;
    }

    const bucket = Math.floor(now() / BOT_WATCHDOG_DEDUP_WINDOW_MS);
    const dedupKey = `bot-join-failed:${row.sessionId}:${bucket}`;

    try {
      await deps.notificationEnqueuer.enqueueBotJoinFailed({
        tenantId: row.tenantId,
        sessionId: row.sessionId,
        ownerUserId: row.ownerUserId,
        meetingId: row.meetingId,
        source: row.source,
        dedupKey,
      });
      await deps.heartbeatStore.markWatchdogFired(
        heartbeatKey,
        Math.floor(BOT_WATCHDOG_DEDUP_WINDOW_MS / 1000),
      );
      enqueued += 1;
    } catch (err) {
      deps.logger.error(
        { err, sessionId: row.sessionId, tenantId: row.tenantId },
        'bot-watchdog: enqueue failed',
      );
    }
  }

  if (enqueued > 0 || suppressed > 0) {
    deps.logger.info({ scanned: rows.length, enqueued, suppressed }, 'bot-watchdog: scan complete');
  } else {
    deps.logger.debug({ scanned: rows.length }, 'bot-watchdog: scan complete');
  }
  return { scanned: rows.length, enqueued, suppressed };
};

export const createBotWatchdogHandler = (deps: BotWatchdogDeps) => {
  return async (): Promise<void> => {
    try {
      await runBotWatchdog(deps);
    } catch (err) {
      deps.logger.error({ err }, 'bot-watchdog: scan failed; will retry next tick');
    }
  };
};
