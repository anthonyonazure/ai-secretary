import { describe, expect, it } from 'vitest';

import { type OfflineQueueItem, deriveOfflineQueueState } from './use-offline-queue-state.js';

const item = (overrides: Partial<OfflineQueueItem> = {}): OfflineQueueItem => ({
  id: 'i-1',
  kind: 'recording-chunk',
  enqueuedAtMs: 0,
  attemptCount: 0,
  sizeBytes: 1024,
  ...overrides,
});

describe('deriveOfflineQueueState', () => {
  it('hides the banner when online with an empty queue', () => {
    const r = deriveOfflineQueueState({ items: [], isOnline: true, isSyncing: false });
    expect(r.banner).toBe('hidden');
    expect(r.copy).toBe('');
  });

  it('shows the offline banner when disconnected', () => {
    const now = 1_700_000_000_000;
    const r = deriveOfflineQueueState({
      items: [item({ enqueuedAtMs: now - 60_000 })],
      isOnline: false,
      isSyncing: false,
      now,
    });
    expect(r.banner).toBe('offline');
    expect(r.pendingCount).toBe(1);
    expect(r.copy).toMatch(/1 item queued/);
  });

  it('flags items stuck for over 30 minutes', () => {
    const now = 1_700_000_000_000;
    const r = deriveOfflineQueueState({
      items: [item({ enqueuedAtMs: now - 35 * 60_000 })],
      isOnline: true,
      isSyncing: true,
      now,
    });
    expect(r.banner).toBe('stuck');
    expect(r.oldestAgeMinutes).toBe(35);
    expect(r.copy).toMatch(/tap to retry/);
  });

  it('reports a syncing state when items are recent', () => {
    const now = 1_700_000_000_000;
    const r = deriveOfflineQueueState({
      items: [item({ enqueuedAtMs: now - 10_000 }), item({ id: 'i-2', enqueuedAtMs: now - 5_000 })],
      isOnline: true,
      isSyncing: true,
      now,
    });
    expect(r.banner).toBe('syncing');
    expect(r.pendingCount).toBe(2);
    expect(r.copy).toMatch(/Syncing 2 items/);
  });

  it('sums total bytes pending across all items', () => {
    const r = deriveOfflineQueueState({
      items: [item({ sizeBytes: 1024 }), item({ id: 'i-2', sizeBytes: 2048 })],
      isOnline: true,
      isSyncing: false,
    });
    expect(r.pendingBytes).toBe(3072);
  });

  it('handles offline with an empty queue gracefully', () => {
    const r = deriveOfflineQueueState({ items: [], isOnline: false, isSyncing: false });
    expect(r.banner).toBe('offline');
    expect(r.copy).toMatch(/your work will sync/);
  });
});
