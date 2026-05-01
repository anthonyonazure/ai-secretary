import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AuthFetchDeps,
  AuthFetchError,
  createAuthFetch,
  readProblemDetails,
} from './auth-fetch';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('createAuthFetch (mobile)', () => {
  let getAccessToken: ReturnType<typeof vi.fn>;
  let onRefresh: ReturnType<typeof vi.fn>;
  let onRefreshFailure: ReturnType<typeof vi.fn>;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getAccessToken = vi.fn(() => 'access-1');
    onRefresh = vi.fn(async () => 'access-2');
    onRefreshFailure = vi.fn();
    fetchImpl = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function build(): ReturnType<typeof createAuthFetch> {
    const deps: AuthFetchDeps = {
      getAccessToken: getAccessToken as unknown as () => string | null,
      onRefresh: onRefresh as unknown as () => Promise<string | null>,
      onRefreshFailure: onRefreshFailure as unknown as () => void,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };
    return createAuthFetch(deps);
  }

  it('attaches Authorization header on the happy path', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const authFetch = build();
    const response = await authFetch('https://api.test/me');
    expect(response.status).toBe(200);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    onRefresh.mockResolvedValueOnce('access-2');

    const authFetch = build();
    const response = await authFetch('https://api.test/me');

    expect(response.status).toBe(200);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retryInit = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer access-2');
    expect(onRefreshFailure).not.toHaveBeenCalled();
  });

  it('clears the store and surfaces the 401 when refresh fails', async () => {
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401));
    onRefresh.mockResolvedValueOnce(null);

    const authFetch = build();
    const response = await authFetch('https://api.test/me');

    expect(response.status).toBe(401);
    expect(onRefreshFailure).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when skipAuth is set', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ title: 'Unauthorized' }, 401));
    const authFetch = build();
    const response = await authFetch('https://api.test/login', { skipAuth: true });
    expect(response.status).toBe(401);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe('readProblemDetails (mobile)', () => {
  it('parses RFC 7807 JSON into AuthFetchError', async () => {
    const response = jsonResponse(
      {
        title: 'Validation failed',
        detail: 'Email is required',
        status: 422,
        requestId: 'req_abc',
      },
      422,
    );
    const error = await readProblemDetails(response);
    expect(error).toBeInstanceOf(AuthFetchError);
    expect(error.status).toBe(422);
    expect(error.problem.requestId).toBe('req_abc');
  });

  it('handles non-JSON bodies', async () => {
    const response = new Response('plain', { status: 500 });
    const error = await readProblemDetails(response);
    expect(error.status).toBe(500);
  });
});
