/// <reference lib="dom" />

import type { AuthResponse } from '@aisecretary/shared/schemas/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the token-store module so the hook's localStorage usage is
// fully under our control. Node 22+ ships an experimental
// `globalThis.localStorage` whose API doesn't expose `clear/getItem`
// without a `--localstorage-file` flag, and that polluted global
// shadows the jsdom one in vitest. The mock dodges the issue and keeps
// the tests deterministic regardless of host runtime.
const tokenStoreState: { value: string | null } = { value: null };
vi.mock('../lib/auth/token-store', () => ({
  loadRefreshToken: vi.fn(() => tokenStoreState.value),
  saveRefreshToken: vi.fn((token: string) => {
    tokenStoreState.value = token;
  }),
  clearRefreshToken: vi.fn(() => {
    tokenStoreState.value = null;
  }),
  __TOKEN_STORE_KEY: 'aisecretary.refresh-token',
}));

import { useAuth, useAuthStore } from './use-auth';

function fakeAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'access-token-1',
    expiresIn: 900,
    refreshToken: 'refresh-token-1',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'user@example.test',
      name: 'Example User',
      role: 'org_admin',
      tenantId: '00000000-0000-0000-0000-000000000002',
      region: 'us',
      isMfaEnabled: false,
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withQueryProvider(): {
  wrapper: (props: { children: ReactNode }) => React.ReactElement;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

describe('useAuth (Story 1.5a)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tokenStoreState.value = null;
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticating: false,
      isHydrated: true,
    });
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signup stores session — refresh token rides the httpOnly cookie (Story 1.5e)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(fakeAuthResponse()));
    const { wrapper } = withQueryProvider();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signup({
        tenantName: 'Acme',
        region: 'us',
        email: 'user@example.test',
        password: 'password-12-chars',
        name: 'Example User',
      });
    });

    expect(result.current.user?.email).toBe('user@example.test');
    expect(result.current.accessToken).toBe('access-token-1');
    // Story 1.5e — token-store no longer persists refresh tokens; the
    // server-set cookie carries them. The shim's value stays null.
    expect(tokenStoreState.value).toBeNull();
  });

  it('login stores session when response is kind=session', async () => {
    // Story 1.5c — /login now returns a discriminated union; the
    // `session` arm is shaped as AuthResponse + kind.
    fetchSpy.mockResolvedValueOnce(jsonResponse({ kind: 'session', ...fakeAuthResponse() }));
    const { wrapper } = withQueryProvider();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({ email: 'user@example.test', password: 'pw' });
    });

    expect(result.current.user?.email).toBe('user@example.test');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('login returns kind=mfa-required without setting session', async () => {
    // Story 1.5c — when MFA is required, the auth store stays empty
    // and the route is responsible for handling the challenge.
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        kind: 'mfa-required',
        challengeToken: 'ct-123',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        enrollmentRequired: false,
      }),
    );
    const { wrapper } = withQueryProvider();
    const { result } = renderHook(() => useAuth(), { wrapper });

    let response: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      response = await result.current.login({ email: 'user@example.test', password: 'pw' });
    });

    expect(response?.kind).toBe('mfa-required');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout clears the in-memory store — server clears the cookie (Story 1.5e)', async () => {
    useAuthStore.setState({
      user: fakeAuthResponse().user,
      accessToken: 'access-token-1',
      isAuthenticating: false,
      isHydrated: true,
    });
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { wrapper } = withQueryProvider();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
    expect(result.current.accessToken).toBeNull();
    // Token-store shim is decoupled from the cookie; it stays null.
    expect(tokenStoreState.value).toBeNull();
  });

  it('refresh exchanges the cookie-borne refresh token for a session (Story 1.5e)', async () => {
    // Cookie travels via `credentials: 'include'`; the test fetch mock
    // doesn't validate the actual cookie — it just returns the session
    // payload, mirroring what the server would do when the cookie is
    // valid. A null-cookie path is implicit when the server returns
    // 401, covered separately by the auth-fetch tests.
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(fakeAuthResponse({ accessToken: 'access-token-2' })),
    );
    const { wrapper } = withQueryProvider();
    const { result } = renderHook(() => useAuth(), { wrapper });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.refresh();
    });
    expect(token).toBe('access-token-2');
    expect(result.current.accessToken).toBe('access-token-2');
  });
});
