/// <reference lib="dom" />

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AuthFetch } from '../../../lib/auth/auth-fetch';
import { useSpeakerTurns } from './use-speaker-turns';

const MEETING_ID = '11111111-1111-4111-8111-111111111111';
const API_BASE = 'http://api.test';

function buildWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const VALID_PAYLOAD = {
  meetingId: MEETING_ID,
  turns: [
    {
      turnId: 't-01',
      speaker: 'Alice',
      spanStartMs: 0,
      spanEndMs: 8_000,
      text: 'First.',
      confidence: null,
      sequence: 1,
    },
  ],
};

describe('useSpeakerTurns', () => {
  it('fetches the meeting transcript via authFetch and returns the parsed turns', async () => {
    const authFetch: AuthFetch = vi.fn(async () => {
      return new Response(JSON.stringify(VALID_PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { result } = renderHook(
      () => useSpeakerTurns(MEETING_ID, { authFetch, apiBase: API_BASE }),
      { wrapper: buildWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0]?.turnId).toBe('t-01');
    const mock = vi.mocked(authFetch);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]?.[0]).toBe(`${API_BASE}/api/v1/meetings/${MEETING_ID}/speaker-turns`);
  });

  it('forwards the AbortSignal from React Query to authFetch', async () => {
    const authFetch: AuthFetch = vi.fn(async () => {
      return new Response(JSON.stringify(VALID_PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    renderHook(() => useSpeakerTurns(MEETING_ID, { authFetch, apiBase: API_BASE }), {
      wrapper: buildWrapper(),
    });

    const mock = vi.mocked(authFetch);
    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
    const init = mock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('marks the query as errored when the API returns 401', async () => {
    const authFetch: AuthFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ title: 'Unauthorized', detail: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { result } = renderHook(
      () => useSpeakerTurns(MEETING_ID, { authFetch, apiBase: API_BASE }),
      { wrapper: buildWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.turns).toEqual([]);
  });

  it('does not fetch when meetingId is undefined', () => {
    const authFetch: AuthFetch = vi.fn(async () => {
      return new Response(JSON.stringify(VALID_PAYLOAD), { status: 200 });
    });

    renderHook(() => useSpeakerTurns(undefined, { authFetch, apiBase: API_BASE }), {
      wrapper: buildWrapper(),
    });

    const mock = vi.mocked(authFetch);
    expect(mock).not.toHaveBeenCalled();
  });
});
