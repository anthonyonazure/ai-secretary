/**
 * Story 4.4 — capture-side heartbeat emitter (React Native).
 *
 * Mirror of `apps/web/src/hooks/use-recording-heartbeat.ts`. Differences:
 *
 *   - No `document.visibilityState` on RN; use `AppState` from
 *     `react-native`. When `AppState.currentState === 'background'` we
 *     skip the emit (battery friendliness + iOS suspends timers in
 *     background after ~30s anyway).
 *   - Tests inject an `appStateRef` closure to avoid coupling vitest to
 *     a real `AppState` module.
 *
 * The hook itself is a thin wrapper around `startHeartbeatScheduler` —
 * the pure function carries all the state-machine + emit logic and is
 * the supported test entry point (vitest under RN has no renderer).
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface HeartbeatSchedulerOptions {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  apiBase: string;
  intervalMs: number;
  appStateRef: () => AppStateStatus;
  recordingId: string;
}

export interface HeartbeatScheduler {
  stop(): void;
}

export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Pure scheduler — no React. Returns a `stop` handle. Public so
 * vitest (under node) can drive the lifecycle without mounting RN.
 */
export const startHeartbeatScheduler = (options: HeartbeatSchedulerOptions): HeartbeatScheduler => {
  const apiBase = options.apiBase.endsWith('/') ? options.apiBase.slice(0, -1) : options.apiBase;
  const url = `${apiBase}/api/v1/recordings/${options.recordingId}/heartbeat`;

  const emit = async (): Promise<void> => {
    const state = options.appStateRef();
    if (state === 'background' || state === 'inactive') return;
    try {
      await options.authFetch(url, { method: 'POST' });
    } catch {
      // Fire-and-forget; watchdog handles sustained loss.
    }
  };

  const handle = setInterval(() => {
    void emit();
  }, options.intervalMs);

  return {
    stop() {
      clearInterval(handle);
    },
  };
};

export interface UseRecordingHeartbeatOptions {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  apiBase: string;
  intervalMs?: number;
  /**
   * Pluggable AppState reader. Production reads from
   * `AppState.currentState`; tests inject a closure.
   */
  appStateRef?: () => AppStateStatus;
}

export function useRecordingHeartbeat(
  recordingId: string | null,
  options: UseRecordingHeartbeatOptions,
): void {
  const intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS;

  useEffect(() => {
    if (!recordingId) return;
    const scheduler = startHeartbeatScheduler({
      recordingId,
      authFetch: options.authFetch,
      apiBase: options.apiBase,
      intervalMs,
      appStateRef: options.appStateRef ?? (() => AppState.currentState),
    });
    return () => {
      scheduler.stop();
    };
  }, [recordingId, intervalMs, options.apiBase, options.authFetch, options.appStateRef]);
}
