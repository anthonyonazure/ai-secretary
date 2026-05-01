/**
 * `deriveUserOnboardingProgress` — the F2-user (non-admin) first-launch
 * progress derivation. Mirrors the F2-admin helper but for the
 * recipient-flow side: sample-meeting / record-first / install-app /
 * thumbs-fed-back / quiet-hours-set.
 *
 * Used by the inbox + the Settings → Onboarding row to show "you're 60%
 * of the way through getting set up".
 */

export type UserOnboardingMilestone =
  | 'opened-inbox'
  | 'viewed-sample'
  | 'recorded-first-meeting'
  | 'reviewed-first-receipt'
  | 'submitted-thumbs'
  | 'set-notification-prefs';

export type UserOnboardingInput = {
  hasOpenedInbox: boolean;
  viewedSampleAtMs: number | null;
  firstRecordingAtMs: number | null;
  firstReceiptViewedAtMs: number | null;
  submittedThumbsAtMs: number | null;
  setNotificationPrefsAtMs: number | null;
};

export type UserOnboardingResult = {
  completed: ReadonlyArray<UserOnboardingMilestone>;
  remaining: ReadonlyArray<UserOnboardingMilestone>;
  percent: number;
  nextNudge: { milestone: UserOnboardingMilestone; copy: string } | null;
};

const ORDER: ReadonlyArray<UserOnboardingMilestone> = [
  'opened-inbox',
  'viewed-sample',
  'recorded-first-meeting',
  'reviewed-first-receipt',
  'submitted-thumbs',
  'set-notification-prefs',
];

const NUDGE_COPY: Record<UserOnboardingMilestone, string> = {
  'opened-inbox': '',
  'viewed-sample': 'Try a sample meeting to see what AI Secretary does.',
  'recorded-first-meeting': 'Record your first meeting — even 30 seconds works.',
  'reviewed-first-receipt': 'Open your latest receipt to see the analysis.',
  'submitted-thumbs': 'Was the receipt helpful? Quick thumbs help us tune your modules.',
  'set-notification-prefs': 'Pick your notification preferences — push, email, or in-app only.',
};

export const deriveUserOnboardingProgress = (input: UserOnboardingInput): UserOnboardingResult => {
  const done: Record<UserOnboardingMilestone, boolean> = {
    'opened-inbox': input.hasOpenedInbox,
    'viewed-sample': input.viewedSampleAtMs !== null,
    'recorded-first-meeting': input.firstRecordingAtMs !== null,
    'reviewed-first-receipt': input.firstReceiptViewedAtMs !== null,
    'submitted-thumbs': input.submittedThumbsAtMs !== null,
    'set-notification-prefs': input.setNotificationPrefsAtMs !== null,
  };
  const completed = ORDER.filter((m) => done[m]);
  const remaining = ORDER.filter((m) => !done[m]);
  const percent = Math.round((completed.length / ORDER.length) * 100);

  const next = remaining[0] ?? null;
  const nextNudge =
    next === null || NUDGE_COPY[next].length === 0
      ? null
      : { milestone: next, copy: NUDGE_COPY[next] };

  return { completed, remaining, percent, nextNudge };
};
