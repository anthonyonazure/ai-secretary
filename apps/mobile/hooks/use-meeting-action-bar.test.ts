import { describe, expect, it } from 'vitest';

import { deriveMeetingActionBar } from './use-meeting-action-bar.js';

const baseInput = {
  lifecycle: 'ready' as const,
  isOwner: true,
  isAdmin: false,
  hasShareEntitlement: true,
  hasCrmEntitlement: false,
  hasLmsEntitlement: false,
  isClinicalVertical: false,
};

describe('deriveMeetingActionBar', () => {
  it('shows share as primary when lifecycle is ready', () => {
    const entries = deriveMeetingActionBar(baseInput);
    const share = entries.find((e) => e.id === 'share');
    expect(share?.enabled).toBe(true);
    expect(share?.primary).toBe(true);
  });

  it('disables share with an entitlement reason on free tier', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, hasShareEntitlement: false });
    const share = entries.find((e) => e.id === 'share');
    expect(share?.enabled).toBe(false);
    expect(share?.disabledReason).toMatch(/Pro tier/);
  });

  it('disables export until analysis completes', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, lifecycle: 'analyzing' });
    const exp = entries.find((e) => e.id === 'export');
    expect(exp?.enabled).toBe(false);
  });

  it('shows push-to-crm only when CRM is entitled', () => {
    const without = deriveMeetingActionBar(baseInput);
    expect(without.some((e) => e.id === 'push-to-crm')).toBe(false);
    const withCrm = deriveMeetingActionBar({ ...baseInput, hasCrmEntitlement: true });
    expect(withCrm.some((e) => e.id === 'push-to-crm')).toBe(true);
  });

  it('shows LMS-grade only when LMS is entitled', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, hasLmsEntitlement: true });
    expect(entries.some((e) => e.id === 'lms-grade')).toBe(true);
  });

  it('lets owners reanalyze on a failed lifecycle', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, lifecycle: 'failed' });
    const reanalyze = entries.find((e) => e.id === 'reanalyze');
    expect(reanalyze?.enabled).toBe(true);
  });

  it('hides "Request correction" on clinical verticals', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, isClinicalVertical: true });
    expect(entries.some((e) => e.id === 'request-correction')).toBe(false);
  });

  it('blocks delete on a clinical vertical for non-admin owners', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, isClinicalVertical: true });
    const del = entries.find((e) => e.id === 'delete');
    expect(del?.enabled).toBe(false);
    expect(del?.disabledReason).toMatch(/admin/);
  });

  it('allows admin delete on a clinical vertical', () => {
    const entries = deriveMeetingActionBar({
      ...baseInput,
      isClinicalVertical: true,
      isAdmin: true,
    });
    const del = entries.find((e) => e.id === 'delete');
    expect(del?.enabled).toBe(true);
  });

  it('hides delete + reanalyze for a non-owner non-admin', () => {
    const entries = deriveMeetingActionBar({ ...baseInput, isOwner: false });
    expect(entries.some((e) => e.id === 'delete')).toBe(false);
    expect(entries.some((e) => e.id === 'reanalyze')).toBe(false);
  });
});
