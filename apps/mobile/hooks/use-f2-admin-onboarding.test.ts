import { describe, expect, it } from 'vitest';

import { deriveF2AdminOnboarding } from './use-f2-admin-onboarding.js';

const blankInput = {
  dpaAcceptedAt: null,
  regionPinnedAt: null,
  retentionConfiguredAt: null,
  disclosureConfiguredAt: null,
  inviteSentAt: null,
  inviteSkipped: false,
};

describe('deriveF2AdminOnboarding', () => {
  it('starts at accept-dpa with 0% complete', () => {
    const r = deriveF2AdminOnboarding(blankInput);
    expect(r.currentStep).toBe('accept-dpa');
    expect(r.percentComplete).toBe(0);
    expect(r.canSkip).toBe(false);
  });

  it('advances to region-pin once DPA is accepted', () => {
    const r = deriveF2AdminOnboarding({
      ...blankInput,
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
    });
    expect(r.currentStep).toBe('region-pin');
    expect(r.percentComplete).toBe(20);
  });

  it('flags invite-team as skippable when reached', () => {
    const r = deriveF2AdminOnboarding({
      ...blankInput,
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
      regionPinnedAt: '2026-04-30T10:01:00Z',
      retentionConfiguredAt: '2026-04-30T10:02:00Z',
      disclosureConfiguredAt: '2026-04-30T10:03:00Z',
    });
    expect(r.currentStep).toBe('invite-team');
    expect(r.canSkip).toBe(true);
    expect(r.percentComplete).toBe(80);
  });

  it('marks complete when invites have been sent', () => {
    const r = deriveF2AdminOnboarding({
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
      regionPinnedAt: '2026-04-30T10:01:00Z',
      retentionConfiguredAt: '2026-04-30T10:02:00Z',
      disclosureConfiguredAt: '2026-04-30T10:03:00Z',
      inviteSentAt: '2026-04-30T10:04:00Z',
      inviteSkipped: false,
    });
    expect(r.currentStep).toBe('complete');
    expect(r.percentComplete).toBe(100);
  });

  it('also marks complete when invites are explicitly skipped', () => {
    const r = deriveF2AdminOnboarding({
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
      regionPinnedAt: '2026-04-30T10:01:00Z',
      retentionConfiguredAt: '2026-04-30T10:02:00Z',
      disclosureConfiguredAt: '2026-04-30T10:03:00Z',
      inviteSentAt: null,
      inviteSkipped: true,
    });
    expect(r.currentStep).toBe('complete');
    expect(r.percentComplete).toBe(100);
  });

  it('keeps current step pointed at the first uncompleted required gate', () => {
    const r = deriveF2AdminOnboarding({
      ...blankInput,
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
      retentionConfiguredAt: '2026-04-30T10:02:00Z',
    });
    expect(r.currentStep).toBe('region-pin');
    expect(r.completedSteps).toContain('accept-dpa');
    expect(r.completedSteps).toContain('retention');
  });

  it('lists remaining steps in canonical order', () => {
    const r = deriveF2AdminOnboarding({
      ...blankInput,
      dpaAcceptedAt: '2026-04-30T10:00:00Z',
      regionPinnedAt: '2026-04-30T10:01:00Z',
    });
    expect(r.remainingSteps).toEqual(['retention', 'disclosure', 'invite-team']);
  });
});
