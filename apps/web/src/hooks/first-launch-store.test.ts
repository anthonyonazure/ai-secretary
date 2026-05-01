// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FIRST_LAUNCH_STORAGE_KEY_FOR_TEST, useFirstLaunchStore } from './first-launch-store';

afterEach(() => {
  // Reset between tests — Zustand's create() is module-singleton, so
  // state would otherwise bleed across cases.
  useFirstLaunchStore.getState().reset();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FIRST_LAUNCH_STORAGE_KEY_FOR_TEST);
  }
});

describe('useFirstLaunchStore', () => {
  it('starts with zero receipts viewed', () => {
    expect(useFirstLaunchStore.getState().receiptsViewed).toBe(0);
    expect(useFirstLaunchStore.getState().viewedMeetingIds).toEqual([]);
  });

  it('increments receiptsViewed once per unique meeting id', () => {
    useFirstLaunchStore.getState().markReceiptViewed('m1');
    useFirstLaunchStore.getState().markReceiptViewed('m1');
    useFirstLaunchStore.getState().markReceiptViewed('m2');
    expect(useFirstLaunchStore.getState().receiptsViewed).toBe(2);
    expect(useFirstLaunchStore.getState().viewedMeetingIds).toEqual(['m1', 'm2']);
  });

  it('records thumbs responses keyed by meeting id', () => {
    useFirstLaunchStore.getState().recordThumbs('m1', 'up');
    useFirstLaunchStore.getState().recordThumbs('m2', 'down');
    expect(useFirstLaunchStore.getState().thumbsResponses).toEqual({
      m1: 'up',
      m2: 'down',
    });
  });

  it('persists state to localStorage', () => {
    useFirstLaunchStore.getState().markReceiptViewed('m1');
    useFirstLaunchStore.getState().recordThumbs('m1', 'up');
    const raw = window.localStorage.getItem(FIRST_LAUNCH_STORAGE_KEY_FOR_TEST);
    expect(raw).not.toBeNull();
    expect(raw).toContain('m1');
  });

  it('sets re-engagement suppression cutoff', () => {
    const before = Date.now();
    useFirstLaunchStore.getState().suppressReEngagement(30 * 24 * 60 * 60 * 1000);
    const cutoff = useFirstLaunchStore.getState().reEngagementSuppressedUntil;
    expect(cutoff).not.toBeNull();
    expect(cutoff ?? 0).toBeGreaterThanOrEqual(before);
  });
});
