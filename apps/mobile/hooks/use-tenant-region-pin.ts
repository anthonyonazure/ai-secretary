/**
 * `deriveTenantRegionPin` — F2-admin region-pin display state.
 *
 * Per ADR-0004, region pinning is a one-shot operation: once a tenant
 * has pinned to `us-east-1` or `eu-west-1`, the column is locked and
 * the admin UI shows it as immutable. This helper renders the right
 * state (unset → confirm → locked).
 */

export type TenantRegion = 'us' | 'eu';

export type TenantRegionPinInput = {
  pinnedRegion: TenantRegion | null;
  pinnedAtMs: number | null;
  pendingRegion: TenantRegion | null;
  isPinning: boolean;
  errorMessage: string | null;
};

export type TenantRegionPinState = {
  display: 'unset' | 'pending' | 'locked' | 'error';
  primaryCopy: string;
  secondaryCopy: string | null;
  showConfirmDialog: boolean;
  canSelect: boolean;
};

const REGION_LABEL: Record<TenantRegion, string> = {
  us: 'United States (us-east-1)',
  eu: 'European Union (eu-west-1)',
};

export const deriveTenantRegionPin = (input: TenantRegionPinInput): TenantRegionPinState => {
  if (input.errorMessage) {
    return {
      display: 'error',
      primaryCopy: input.errorMessage,
      secondaryCopy: null,
      showConfirmDialog: false,
      canSelect: input.pinnedRegion === null,
    };
  }
  if (input.pinnedRegion !== null) {
    return {
      display: 'locked',
      primaryCopy: REGION_LABEL[input.pinnedRegion],
      secondaryCopy: 'Locked — region pinning is one-shot per ADR-0004.',
      showConfirmDialog: false,
      canSelect: false,
    };
  }
  if (input.pendingRegion !== null) {
    return {
      display: 'pending',
      primaryCopy: REGION_LABEL[input.pendingRegion],
      secondaryCopy: input.isPinning
        ? 'Pinning region — this will lock immediately.'
        : 'Confirm to lock this region permanently.',
      showConfirmDialog: !input.isPinning,
      canSelect: !input.isPinning,
    };
  }
  return {
    display: 'unset',
    primaryCopy: 'Select your data region.',
    secondaryCopy: 'After you pin, the choice cannot be changed.',
    showConfirmDialog: false,
    canSelect: true,
  };
};
