/**
 * `useRetryBudget` — pure helper for the resumable upload retry
 * machinery (FR68). Tracks a 10-minute budget per recording: every
 * successful chunk resets the budget; every retry burns time without
 * resetting. When the budget elapses, the upload escalates.
 *
 * Inputs:
 *   - `lastSuccessfulChunkAtMs` — when the most-recent chunk landed
 *   - `now`                     — testable clock
 *   - `inFlight`                — true while an upload is active
 *
 * Output:
 *   - `state`           — 'fresh' | 'retrying' | 'escalated' | 'idle'
 *   - `secondsRemaining` — seconds until escalation; 0 once elapsed
 *   - `shouldEscalate`  — true when the budget elapsed AND we're not idle
 *
 * The 10-min budget is the BEFORE-escalation window. After escalation
 * the upload doesn't stop — the user is just told it's struggling and
 * given a manual retry CTA.
 */

const TEN_MIN_MS = 10 * 60 * 1000;

export type RetryBudgetState = 'idle' | 'fresh' | 'retrying' | 'escalated';

export interface RetryBudgetInput {
  /** ms since epoch of the last successful chunk; null when none. */
  lastSuccessfulChunkAtMs: number | null;
  /** Whether the upload is currently inflight. */
  inFlight: boolean;
  /** Now reference. */
  now?: number;
  /** Override the budget length (tests). Default 10 minutes. */
  budgetMs?: number;
}

export interface RetryBudgetOutput {
  state: RetryBudgetState;
  secondsRemaining: number;
  shouldEscalate: boolean;
}

export const deriveRetryBudget = (input: RetryBudgetInput): RetryBudgetOutput => {
  const budget = input.budgetMs ?? TEN_MIN_MS;
  const now = input.now ?? Date.now();
  if (!input.inFlight) {
    return { state: 'idle', secondsRemaining: Math.floor(budget / 1000), shouldEscalate: false };
  }
  if (input.lastSuccessfulChunkAtMs === null) {
    // Inflight but zero chunks landed yet — treat as fresh start.
    return {
      state: 'fresh',
      secondsRemaining: Math.floor(budget / 1000),
      shouldEscalate: false,
    };
  }
  const elapsed = Math.max(0, now - input.lastSuccessfulChunkAtMs);
  if (elapsed >= budget) {
    return { state: 'escalated', secondsRemaining: 0, shouldEscalate: true };
  }
  // Anything past 30s with no new chunk = retrying.
  if (elapsed > 30 * 1000) {
    return {
      state: 'retrying',
      secondsRemaining: Math.floor((budget - elapsed) / 1000),
      shouldEscalate: false,
    };
  }
  return {
    state: 'fresh',
    secondsRemaining: Math.floor((budget - elapsed) / 1000),
    shouldEscalate: false,
  };
};
