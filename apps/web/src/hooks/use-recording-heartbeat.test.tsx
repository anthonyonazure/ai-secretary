import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecordingHeartbeat } from './use-recording-heartbeat';

describe('useRecordingHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits POST /heartbeat every interval while recordingId is non-null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { rerender } = renderHook(
      ({ recordingId }: { recordingId: string | null }) =>
        useRecordingHeartbeat(recordingId, {
          authFetch: fetchMock as unknown as Parameters<
            typeof useRecordingHeartbeat
          >[1]['authFetch'],
          apiBase: 'http://localhost:3001',
          intervalMs: 1000,
          visibilityStateRef: () => 'visible',
        }),
      { initialProps: { recordingId: 'rec-1' as string | null } },
    );

    // No emit before the first interval tick — first call is on tick.
    expect(fetchMock).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3001/api/v1/recordings/rec-1/heartbeat',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Setting recordingId = null should stop emits.
    rerender({ recordingId: null });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('pauses emits when document.visibilityState is hidden', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    let visibility: DocumentVisibilityState = 'visible';

    renderHook(() =>
      useRecordingHeartbeat('rec-1', {
        authFetch: fetchMock as unknown as Parameters<typeof useRecordingHeartbeat>[1]['authFetch'],
        apiBase: 'http://localhost:3001',
        intervalMs: 1000,
        visibilityStateRef: () => visibility,
      }),
    );

    visibility = 'hidden';
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    visibility = 'visible';
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not emit when recordingId is null on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    renderHook(() =>
      useRecordingHeartbeat(null, {
        authFetch: fetchMock as unknown as Parameters<typeof useRecordingHeartbeat>[1]['authFetch'],
        apiBase: 'http://localhost:3001',
        intervalMs: 1000,
        visibilityStateRef: () => 'visible',
      }),
    );

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('swallows fetch failures silently', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    renderHook(() =>
      useRecordingHeartbeat('rec-1', {
        authFetch: fetchMock as unknown as Parameters<typeof useRecordingHeartbeat>[1]['authFetch'],
        apiBase: 'http://localhost:3001',
        intervalMs: 1000,
        visibilityStateRef: () => 'visible',
      }),
    );

    await vi.advanceTimersByTimeAsync(1000);
    // Not throwing = pass. The next tick still emits.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
