/**
 * `dedup-bucket` — pure helpers for cron-firing notification dispatchers.
 *
 * Multiple worker handlers (re-engagement-scan, trial-reminder-scan,
 * recording-watchdog, retention-purge) need a deterministic dedup key
 * that:
 *   - Rolls forward at a stable cadence (per minute, per hour, per UTC
 *     day, per week) so retries within the same window collapse to
 *     the same key
 *   - Encodes the cadence in the key so accidental cross-cadence
 *     collisions are impossible
 *
 * This module owns the cadence math so handlers don't have to roll
 * their own. Production handlers use it; tests exercise it directly
 * to assert the rollover boundaries.
 */

export type Cadence = 'minute' | 'hour' | 'day' | 'week';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const padTwo = (n: number): string => String(n).padStart(2, '0');

/**
 * Returns a stable bucket label for `now` at the given cadence:
 *   - 'minute' → 'YYYYMMDDHHmm'
 *   - 'hour'   → 'YYYYMMDDHH'
 *   - 'day'    → 'YYYYMMDD'
 *   - 'week'   → 'GGGG-Www' (ISO 8601 week — Monday-anchored)
 */
export const computeBucket = (cadence: Cadence, now: Date): string => {
  const yyyy = now.getUTCFullYear();
  const mm = padTwo(now.getUTCMonth() + 1);
  const dd = padTwo(now.getUTCDate());
  if (cadence === 'minute') {
    return `${yyyy}${mm}${dd}${padTwo(now.getUTCHours())}${padTwo(now.getUTCMinutes())}`;
  }
  if (cadence === 'hour') {
    return `${yyyy}${mm}${dd}${padTwo(now.getUTCHours())}`;
  }
  if (cadence === 'day') {
    return `${yyyy}${mm}${dd}`;
  }
  // ISO 8601 week — Monday is the start of the week.
  const target = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate()));
  // ISO weekday: 1..7 (Mon..Sun).
  const dayNum = target.getUTCDay() === 0 ? 7 : target.getUTCDay();
  // Move to nearest Thursday (the ISO-week "anchor").
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(target.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((target.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${target.getUTCFullYear()}-W${padTwo(week)}`;
};

export interface DedupKeyInput {
  /** Logical signal name, e.g. 'capture-at-risk', 'trial-reminder-T-3d'. */
  signal: string;
  /** Per-row identifier (recordingId, tenantId, userId, etc). */
  scopeId: string;
  /** How often this signal can fire per scope. */
  cadence: Cadence;
  /** Now reference (testable). */
  now: Date;
}

/**
 * Compute a worker dedup-key. Format:
 *   `<signal>:<scopeId>:<bucketLabel>`
 * Example:
 *   `capture-at-risk:rec-123:202604300010`
 */
export const computeDedupKey = (input: DedupKeyInput): string => {
  const bucket = computeBucket(input.cadence, input.now);
  return `${input.signal}:${input.scopeId}:${bucket}`;
};

export {
  /** Re-export the constants for handlers that want to compute their own windows. */
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
};
