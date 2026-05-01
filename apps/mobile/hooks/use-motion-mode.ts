/**
 * `resolveMotionMode` — derives the active motion mode for the app shell
 * (referenced by FR75 token build pipeline + the reduced-motion lint
 * rule on transitions).
 *
 * Precedence: explicit user choice → OS prefers-reduced-motion → default
 * (`full`). Pure helper — both web and native call it from their own
 * media-query / accessibility-info subscriptions.
 */

export type MotionMode = 'full' | 'reduced' | 'off';

export type MotionModeInput = {
  userOverride: MotionMode | null;
  osPrefersReducedMotion: boolean;
  /** Some users set "off" globally — e.g., vestibular-disorder accommodations. */
  osPrefersNoMotion: boolean;
};

export type MotionModeResolution = {
  mode: MotionMode;
  source: 'override' | 'os' | 'default';
  /** True when transitions / waveforms / hero animations should be skipped. */
  shouldDisableMotion: boolean;
};

export const resolveMotionMode = (input: MotionModeInput): MotionModeResolution => {
  if (input.userOverride !== null) {
    return {
      mode: input.userOverride,
      source: 'override',
      shouldDisableMotion: input.userOverride !== 'full',
    };
  }
  if (input.osPrefersNoMotion) {
    return { mode: 'off', source: 'os', shouldDisableMotion: true };
  }
  if (input.osPrefersReducedMotion) {
    return { mode: 'reduced', source: 'os', shouldDisableMotion: true };
  }
  return { mode: 'full', source: 'default', shouldDisableMotion: false };
};

/** Convenience helper: most callers just want a boolean. */
export const isMotionDisabled = (input: MotionModeInput): boolean =>
  resolveMotionMode(input).shouldDisableMotion;
