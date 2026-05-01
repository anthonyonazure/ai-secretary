/**
 * `deriveF2AdminOnboarding` — FR72 admin first-launch onboarding state.
 *
 * F2-admin is a structurally distinct onboarding from F2-user (per UX
 * spec). Sequence (per epics.md FR72):
 *   1. accept-dpa     — Data processing agreement acceptance
 *   2. region-pin     — One-shot region pin (immutable per ADR-0004)
 *   3. retention      — Default retention windows (audio / transcript / analyses)
 *   4. disclosure     — Pre-mic / bot-announcement / patient disclosure copy
 *   5. invite-team    — Invite first wave of org members (skippable)
 *   6. complete       — Done — admin lands on the standard inbox
 *
 * The hook is pure: hosts persist the current step in tenant_admin_state
 * and pass it in. We compute the next visible step + completion %.
 */

export type F2AdminStep =
  | 'accept-dpa'
  | 'region-pin'
  | 'retention'
  | 'disclosure'
  | 'invite-team'
  | 'complete';

export type F2AdminInput = {
  dpaAcceptedAt: string | null;
  regionPinnedAt: string | null;
  retentionConfiguredAt: string | null;
  disclosureConfiguredAt: string | null;
  inviteSentAt: string | null;
  inviteSkipped: boolean;
};

export type F2AdminState = {
  currentStep: F2AdminStep;
  completedSteps: ReadonlyArray<F2AdminStep>;
  remainingSteps: ReadonlyArray<F2AdminStep>;
  percentComplete: number;
  canSkip: boolean;
};

const STEP_ORDER: ReadonlyArray<Exclude<F2AdminStep, 'complete'>> = [
  'accept-dpa',
  'region-pin',
  'retention',
  'disclosure',
  'invite-team',
];

const REQUIRED_STEPS: ReadonlyArray<Exclude<F2AdminStep, 'complete'>> = [
  'accept-dpa',
  'region-pin',
  'retention',
  'disclosure',
];

export const deriveF2AdminOnboarding = (input: F2AdminInput): F2AdminState => {
  const stepDone: Record<Exclude<F2AdminStep, 'complete'>, boolean> = {
    'accept-dpa': input.dpaAcceptedAt !== null,
    'region-pin': input.regionPinnedAt !== null,
    retention: input.retentionConfiguredAt !== null,
    disclosure: input.disclosureConfiguredAt !== null,
    'invite-team': input.inviteSentAt !== null || input.inviteSkipped,
  };

  const completedSteps = STEP_ORDER.filter((s) => stepDone[s]);
  const remainingSteps = STEP_ORDER.filter((s) => !stepDone[s]);

  const requiredDone = REQUIRED_STEPS.every((s) => stepDone[s]);
  const allDone = STEP_ORDER.every((s) => stepDone[s]);

  const currentStep: F2AdminStep =
    remainingSteps.length === 0 ? 'complete' : (remainingSteps[0] ?? 'complete');

  const percentComplete = Math.round((completedSteps.length / STEP_ORDER.length) * 100);

  return {
    currentStep: allDone
      ? 'complete'
      : requiredDone && remainingSteps[0] === 'invite-team'
        ? 'invite-team'
        : currentStep,
    completedSteps,
    remainingSteps,
    percentComplete,
    canSkip: currentStep === 'invite-team',
  };
};
