/**
 * `useHeartbeatWindow` — mobile capture-at-risk detection (FR67).
 *
 * Pure derivation that takes the most-recent heartbeat timestamp +
 * the current time, returns the user-facing state:
 *   - `'fresh'`       — last ping <30s ago (normal)
 *   - `'warning'`     — last ping 30s-90s ago (subtle hint, not alarming)
 *   - `'at-risk'`     — last ping >90s ago (assertive banner; FR67)
 *
 * The mobile screen renders a CaptureAtRiskBanner-equivalent at the
 * `'at-risk'` threshold. The intermediate `'warning'` state surfaces a
 * subtle "weak signal" line without alarming the user — the 30s-90s
 * window is normal jitter for cellular networks.
 */

const THIRTY_SECONDS_MS = 30 * 1000;
const NINETY_SECONDS_MS = 90 * 1000;

export type HeartbeatWindowState = 'fresh' | 'warning' | 'at-risk' | 'never';

export interface HeartbeatWindowInput {
  /** Last successful heartbeat timestamp; null when no heartbeat has fired yet. */
  lastHeartbeatMs: number | null;
  /** Now reference for testability. */
  now?: number;
  /**
   * Recording-FSM gate — heartbeat-window detection only fires when
   * the recording is active. Idle / paused / uploading don't escalate
   * since no heartbeat is expected.
   */
  isCapturing: boolean;
}

export interface HeartbeatWindowOutput {
  state: HeartbeatWindowState;
  /** Seconds since the last heartbeat. -1 when never. */
  secondsSinceLastPing: number;
  /** Should the assertive at-risk banner render? */
  showAtRiskBanner: boolean;
}

export const deriveHeartbeatWindow = (input: HeartbeatWindowInput): HeartbeatWindowOutput => {
  if (!input.isCapturing) {
    return { state: 'fresh', secondsSinceLastPing: 0, showAtRiskBanner: false };
  }
  if (input.lastHeartbeatMs === null) {
    return { state: 'never', secondsSinceLastPing: -1, showAtRiskBanner: false };
  }
  const now = input.now ?? Date.now();
  const elapsedMs = Math.max(0, now - input.lastHeartbeatMs);
  const seconds = Math.floor(elapsedMs / 1000);
  if (elapsedMs < THIRTY_SECONDS_MS) {
    return { state: 'fresh', secondsSinceLastPing: seconds, showAtRiskBanner: false };
  }
  if (elapsedMs < NINETY_SECONDS_MS) {
    return { state: 'warning', secondsSinceLastPing: seconds, showAtRiskBanner: false };
  }
  return { state: 'at-risk', secondsSinceLastPing: seconds, showAtRiskBanner: true };
};
