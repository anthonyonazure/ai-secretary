import { describe, expect, it } from 'vitest';

import {
  evaluateNotificationPreference,
  isTransactionalNotificationKind,
} from './use-notification-preferences.js';

describe('evaluateNotificationPreference', () => {
  it('allows a non-opted-out notification on an enabled channel', () => {
    const r = evaluateNotificationPreference('analysis-completed', 'push', {
      userOptOuts: [],
      tenantDisabledChannels: [],
      tenantDisabledKinds: [],
    });
    expect(r.shouldDeliver).toBe(true);
    expect(r.reason).toBe('allowed');
  });

  it('blocks delivery when the user opted out of a non-transactional kind', () => {
    const r = evaluateNotificationPreference('re-engagement-24h', 'email', {
      userOptOuts: [{ channel: 'email', kind: 're-engagement-24h' }],
      tenantDisabledChannels: [],
      tenantDisabledKinds: [],
    });
    expect(r.shouldDeliver).toBe(false);
    expect(r.reason).toBe('user-opt-out');
  });

  it('still delivers a transactional notification despite a user opt-out', () => {
    const r = evaluateNotificationPreference('capture-at-risk', 'push', {
      userOptOuts: [{ channel: 'push', kind: 'capture-at-risk' }],
      tenantDisabledChannels: [],
      tenantDisabledKinds: [],
    });
    expect(r.shouldDeliver).toBe(true);
  });

  it('respects tenant-wide channel kill switch even for transactional notifications', () => {
    const r = evaluateNotificationPreference('capture-at-risk', 'email', {
      userOptOuts: [],
      tenantDisabledChannels: ['email'],
      tenantDisabledKinds: [],
    });
    expect(r.shouldDeliver).toBe(false);
    expect(r.reason).toBe('tenant-channel-off');
  });

  it('blocks non-transactional kinds on a tenant kind kill switch', () => {
    const r = evaluateNotificationPreference('re-engagement-72h', 'email', {
      userOptOuts: [],
      tenantDisabledChannels: [],
      tenantDisabledKinds: ['re-engagement-72h'],
    });
    expect(r.reason).toBe('tenant-kind-off');
  });

  it('lets transactional kinds bypass tenant-kind kill switches', () => {
    const r = evaluateNotificationPreference('tenant-invite', 'email', {
      userOptOuts: [],
      tenantDisabledChannels: [],
      tenantDisabledKinds: ['tenant-invite'],
    });
    expect(r.shouldDeliver).toBe(true);
  });
});

describe('isTransactionalNotificationKind', () => {
  it('classifies capture-at-risk + retry-budget + tenant-invite + dsar-failed as transactional', () => {
    expect(isTransactionalNotificationKind('capture-at-risk')).toBe(true);
    expect(isTransactionalNotificationKind('upload-retry-budget-exhausted')).toBe(true);
    expect(isTransactionalNotificationKind('tenant-invite')).toBe(true);
    expect(isTransactionalNotificationKind('dsar-failed')).toBe(true);
  });

  it('classifies marketing/receipt/re-engagement kinds as non-transactional', () => {
    expect(isTransactionalNotificationKind('analysis-completed')).toBe(false);
    expect(isTransactionalNotificationKind('re-engagement-24h')).toBe(false);
    expect(isTransactionalNotificationKind('trial-reminder')).toBe(false);
    expect(isTransactionalNotificationKind('meeting-receipt-slack')).toBe(false);
  });
});
