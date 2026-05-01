/**
 * Mobile vitest runs under node with no react-native renderer, so the
 * hook itself can't be exercised via `renderHook`. We test the pure
 * `startHeartbeatScheduler` which carries all the timing + AppState
 * logic — same shape as `use-auth.test.ts` / `consent-modal.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native before importing — the test uses the pure scheduler
// which doesn't read AppState directly but the import graph would
// otherwise pull in the real RN module under node and explode.
vi.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));

// Lazy import so the mock is in place first.
import { startHeartbeatScheduler } from './use-recording-heartbeat';

describe('startHeartbeatScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits POST /heartbeat at the configured interval', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const scheduler = startHeartbeatScheduler({
      recordingId: 'rec-1',
      apiBase: 'http://localhost:3001',
      intervalMs: 1000,
      appStateRef: () => 'active',
      authFetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3001/api/v1/recordings/rec-1/heartbeat',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips emits while AppState is background', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    let appState: 'active' | 'background' | 'inactive' = 'active';

    startHeartbeatScheduler({
      recordingId: 'rec-1',
      apiBase: 'http://localhost:3001',
      intervalMs: 1000,
      appStateRef: () => appState,
      authFetch: fetchMock,
    });

    appState = 'background';
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    appState = 'inactive';
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    appState = 'active';
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    startHeartbeatScheduler({
      recordingId: 'rec-1',
      apiBase: 'http://localhost:3001',
      intervalMs: 1000,
      appStateRef: () => 'active',
      authFetch: fetchMock,
    });

    await vi.advanceTimersByTimeAsync(1000);
    // Next tick still emits — the rejection from the prior call must not
    // tear down the loop.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
