/**
 * `useRateLimitTimer` — pure helper for surfacing rate-limit
 * countdowns to the user.
 *
 * The API returns 429 with an `extensions.retryAfterSeconds` hint.
 * The mobile screen parses that hint and uses this helper to tick
 * a "Retry in 12s" label down to zero, then unlocks the action.
 *
 * Inputs:
 *   - `retryAfterSeconds` — server hint
 *   - `lockedAtMs` — when the 429 landed
 *   - `now` — testable
 *
 * Output:
 *   - `state` — 'locked' | 'unlocked'
 *   - `secondsRemaining` — countdown
 *   - `label` — display string
 */

export type RateLimitState = 'locked' | 'unlocked';

export interface RateLimitTimerInput {
  retryAfterSeconds: number;
  lockedAtMs: number;
  now?: number;
}

export interface RateLimitTimerOutput {
  state: RateLimitState;
  secondsRemaining: number;
  label: string;
}

export const deriveRateLimitTimer = (input: RateLimitTimerInput): RateLimitTimerOutput => {
  const now = input.now ?? Date.now();
  const elapsedMs = Math.max(0, now - input.lockedAtMs);
  const totalMs = Math.max(0, input.retryAfterSeconds * 1000);
  const remainingMs = totalMs - elapsedMs;
  if (remainingMs <= 0) {
    return { state: 'unlocked', secondsRemaining: 0, label: 'Try again' };
  }
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return {
    state: 'locked',
    secondsRemaining: remainingSeconds,
    label: `Retry in ${remainingSeconds}s`,
  };
};
