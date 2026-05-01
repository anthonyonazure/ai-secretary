/**
 * `recording-watchdog` queue handler — Story 4.4.
 *
 * Cadence (arch-addendums § 5):
 *   - Capturing client emits POST /heartbeat every 30s.
 *   - Server SETEX `heartbeat:<recordingId>` with TTL 90s.
 *   - This watchdog runs every 15s. For each "in-flight" recording row
 *     (status ∈ uploading | uploaded | transcribing AND started_at within
 *     the last 24h), we check the Redis key. Missing key = lost ping →
 *     enqueue `notification.send` with `kind: 'capture-at-risk'`.
 *   - Watchdog-fired marker (`watchdog-fired:<recordingId>` TTL 5min)
 *     suppresses duplicate notifications within the dedup window.
 *
 * Push delivery target: ≤60s after lost ping. The 15s scan + dedup
 * checks fit comfortably inside that budget; the rest is pg-boss
 * dispatch latency + Expo Push fanout.
 *
 * Worker boot wires this via `boss.schedule('recording-watchdog',
 * '* /15 * * * * *', ...)` (drop the space — escaped in this comment so
 * the JSDoc block doesn't close on the literal star-slash). cron-parser
 * (used by pg-boss) accepts the
 * 6-field "with seconds" form. pg-boss must be configured with
 * `cronMonitorIntervalSeconds` ≤ 15s for sub-minute scheduling to fire
 * at the configured cadence; the worker boot in `src/index.ts` sets
 * this when registering the schedule.
 *
 * Cross-tenant iteration: the watchdog is a system-level scan; we
 * intentionally short-circuit the per-request `withTenantContext`
 * pattern by accepting a `RecordingWatchdogReader` interface. The
 * production reader executes a single SQL query (RLS bypassed via the
 * `app.is_system_job` setting) and returns `{ tenantId, recordingId,
 * meetingId, ownerUserId }` rows. Tests inject a fixture reader.
 */

import type { Logger } from 'pino';

/**
 * One row returned by the watchdog reader. The watchdog only needs
 * enough context to enqueue the notification; downstream callers query
 * additional state through their own surfaces.
 */
export interface InFlightRecording {
  tenantId: string;
  recordingId: string;
  ownerUserId: string;
  meetingId: string | null;
  region: 'us' | 'eu';
}

/**
 * Reader contract — production wires a Drizzle query (or raw SQL) that
 * cross-tenant scans `recordings` for in-flight rows. Tests inject a
 * fixture array.
 */
export interface RecordingWatchdogReader {
  listInFlight(args: { sinceMs: number }): Promise<InFlightRecording[]>;
}

/**
 * Heartbeat-store contract — mirrors the API plugin's `HeartbeatStore`.
 * Re-declared here (not imported from `apps/api`) so the workers
 * package doesn't develop an import cycle. Both packages share the
 * concrete Redis client at runtime.
 */
export interface WatchdogHeartbeatStore {
  isHeartbeatLost(recordingId: string): Promise<boolean>;
  markWatchdogFired(recordingId: string, ttlSeconds: number): Promise<void>;
  hasWatchdogFired(recordingId: string): Promise<boolean>;
}

/**
 * Notification enqueue contract — wraps the pg-boss `notification.send`
 * publish. Production wires `boss.send('notification.send', ...)`;
 * tests capture in an array.
 */
export interface WatchdogNotificationEnqueuer {
  enqueueCaptureAtRisk(args: {
    tenantId: string;
    recordingId: string;
    ownerUserId: string;
    meetingId: string | null;
    dedupKey: string;
  }): Promise<void>;
}

export interface RecordingWatchdogDeps {
  reader: RecordingWatchdogReader;
  heartbeatStore: WatchdogHeartbeatStore;
  notificationEnqueuer: WatchdogNotificationEnqueuer;
  logger: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;
  /**
   * Optional clock injection (tests). Defaults to `Date.now`. Used to
   * compute the 24h cutoff for `listInFlight` and the dedup-window key.
   */
  now?: () => number;
}

export const RECORDING_WATCHDOG_QUEUE = 'recording-watchdog' as const;
/** Cron expression for 15s cadence (6-field, with-seconds form). */
export const RECORDING_WATCHDOG_CRON = '*/15 * * * * *' as const;
/** Lookback for in-flight recordings. Anything older is staled out by other surfaces. */
export const RECORDING_WATCHDOG_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Dedup window for the at-risk notification — same as packages/notifications DEDUP_WINDOW_MS. */
export const WATCHDOG_DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Single watchdog scan — public for direct test invocation. The
 * pg-boss handler wraps this in a per-tick try/catch so a single bad
 * row can't take down the schedule.
 */
export const runRecordingWatchdog = async (
  deps: RecordingWatchdogDeps,
): Promise<{
  scanned: number;
  enqueued: number;
  suppressed: number;
}> => {
  const now = deps.now ?? Date.now;
  const sinceMs = now() - RECORDING_WATCHDOG_LOOKBACK_MS;
  const rows = await deps.reader.listInFlight({ sinceMs });

  let enqueued = 0;
  let suppressed = 0;

  for (const row of rows) {
    const lost = await deps.heartbeatStore.isHeartbeatLost(row.recordingId);
    if (!lost) {
      // Fresh ping — nothing to do.
      continue;
    }
    const alreadyFired = await deps.heartbeatStore.hasWatchdogFired(row.recordingId);
    if (alreadyFired) {
      suppressed += 1;
      continue;
    }
    // Bucketed dedup key — one per 5-min window per recording. Even if
    // the watchdog-fired Redis key gets evicted under memory pressure,
    // the bucket-based dedup at the notifications gateway level keeps
    // duplicate dispatch from breaking through.
    const bucket = Math.floor(now() / WATCHDOG_DEDUP_WINDOW_MS);
    const dedupKey = `capture-at-risk:${row.recordingId}:${bucket}`;
    try {
      await deps.notificationEnqueuer.enqueueCaptureAtRisk({
        tenantId: row.tenantId,
        recordingId: row.recordingId,
        ownerUserId: row.ownerUserId,
        meetingId: row.meetingId,
        dedupKey,
      });
      await deps.heartbeatStore.markWatchdogFired(
        row.recordingId,
        Math.floor(WATCHDOG_DEDUP_WINDOW_MS / 1000),
      );
      enqueued += 1;
    } catch (err) {
      deps.logger.error(
        { err, recordingId: row.recordingId, tenantId: row.tenantId },
        'recording-watchdog: enqueue failed',
      );
    }
  }

  if (enqueued > 0 || suppressed > 0) {
    deps.logger.info(
      { scanned: rows.length, enqueued, suppressed },
      'recording-watchdog: scan complete',
    );
  } else {
    deps.logger.debug({ scanned: rows.length }, 'recording-watchdog: scan complete');
  }
  return { scanned: rows.length, enqueued, suppressed };
};

/**
 * pg-boss handler factory. The handler ignores its job payload (the
 * scheduled job carries no data) and runs one scan per invocation.
 */
export const createRecordingWatchdogHandler = (deps: RecordingWatchdogDeps) => {
  return async (): Promise<void> => {
    try {
      await runRecordingWatchdog(deps);
    } catch (err) {
      deps.logger.error({ err }, 'recording-watchdog: scan crashed');
    }
  };
};
