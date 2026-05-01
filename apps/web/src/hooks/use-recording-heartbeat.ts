/**
 * Story 4.4 — capture-side heartbeat emitter (web).
 *
 * Cadence: every 30s while a recording is in-flight. Server expires
 * the key at 90s (arch-addendums § 5), giving us up to two missed
 * pings before the watchdog fires. Push delivery target = within 60s
 * of detection.
 *
 * Visibility guard: when `document.visibilityState === 'hidden'` the
 * tab is backgrounded. Modern browsers throttle setInterval there
 * already, but we also short-circuit so a paused emit doesn't fire a
 * burst on resume. Resuming a hidden→visible flip will catch up on
 * the next interval tick — at most a 30s gap, which is within the
 * 90s server TTL.
 *
 * Implementation note: this hook does NOT own the recording id; the
 * caller passes `null` to disable. That keeps the hook free of state
 * machine knowledge — the controller decides when a recording goes
 * "in-flight" vs. terminal and toggles the prop accordingly.
 */

import { useEffect } from 'react';
import type { AuthFetch } from '../lib/auth/auth-fetch';

export interface UseRecordingHeartbeatOptions {
  /** Auth-fetch wrapper from `buildAuthDeps()`. */
  authFetch: AuthFetch;
  /** API base URL — typically `resolveApiBaseUrl()`. */
  apiBase: string;
  /**
   * Override the cadence (ms). Default 30_000. Tests use a small
   * value paired with `vi.useFakeTimers()`.
   */
  intervalMs?: number;
  /**
   * Pluggable visibility-state reader. Production reads from
   * `document.visibilityState`; tests inject a closure.
   */
  visibilityStateRef?: () => DocumentVisibilityState;
}

export const HEARTBEAT_INTERVAL_MS = 30_000;

export function useRecordingHeartbeat(
  recordingId: string | null,
  options: UseRecordingHeartbeatOptions,
): void {
  const intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS;

  useEffect(() => {
    if (!recordingId) return;

    const visibility = options.visibilityStateRef ?? defaultVisibility;
    const apiBase = options.apiBase.endsWith('/') ? options.apiBase.slice(0, -1) : options.apiBase;
    const url = `${apiBase}/api/v1/recordings/${recordingId}/heartbeat`;

    const emit = async (): Promise<void> => {
      if (visibility() === 'hidden') return;
      try {
        await options.authFetch(url, { method: 'POST' });
      } catch {
        // Heartbeat is fire-and-forget. Network errors are expected;
        // the watchdog detects sustained loss via the server TTL, not
        // via client-side error handling.
      }
    };

    // Don't burst-fire on mount. The first emit happens on the first
    // interval tick; the server has 90s of slack so a 30s warm-up is
    // safe. (If product wants a leading-edge emit, change the
    // ordering here.)
    const handle = setInterval(() => {
      void emit();
    }, intervalMs);

    return () => {
      clearInterval(handle);
    };
  }, [recordingId, intervalMs, options.apiBase, options.authFetch, options.visibilityStateRef]);
}

const defaultVisibility = (): DocumentVisibilityState => {
  if (typeof document === 'undefined') return 'visible';
  return document.visibilityState;
};
