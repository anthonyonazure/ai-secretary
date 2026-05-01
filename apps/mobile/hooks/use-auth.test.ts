/**
 * Mobile vitest runs under node with no react-native renderer, so the
 * hook itself can't be exercised via `renderHook`. Instead we test the
 * exported store + dependency-builder which carry all the non-React
 * logic — same shape we use for ConsentModal in this app.
 */

import type { AuthResponse } from '@aisecretary/shared/schemas/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock expo-secure-store before importing the modules that depend on it.
const secureStore: Record<string, string> = {};
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  getItemAsync: vi.fn(async (key: string) => secureStore[key] ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore[key] = value;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete secureStore[key];
  }),
}));

// Re-imported lazily so the mock is in place first.
import { buildAuthDeps, useAuthStore } from './use-auth';

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

describe('mobile auth store + deps (Story 1.5a)', () => {
  beforeEach(() => {
    for (const k of Object.keys(secureStore)) delete secureStore[k];
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticating: false,
      isHydrated: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('setSession persists the refresh token to secure-store', async () => {
    const response = fakeAuthResponse();
    await useAuthStore.getState().setSession(response);
    expect(secureStore['aisecretary.refresh-token']).toBe('refresh-token-1');
    expect(useAuthStore.getState().user?.email).toBe('user@example.test');
    expect(useAuthStore.getState().accessToken).toBe('access-token-1');
  });

  it('clear removes the refresh token + resets state', async () => {
    secureStore['aisecretary.refresh-token'] = 'rt';
    useAuthStore.setState({
      user: fakeAuthResponse().user,
      accessToken: 'at',
      isAuthenticating: false,
      isHydrated: true,
    });

    await useAuthStore.getState().clear();
    expect(secureStore['aisecretary.refresh-token']).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('refresh exchanges a stored refresh token via the bare client', async () => {
    secureStore['aisecretary.refresh-token'] = 'refresh-token-1';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(fakeAuthResponse({ accessToken: 'access-token-2' })));
    const deps = buildAuthDeps({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const token = await deps.refresh();
    expect(token).toBe('access-token-2');
    expect(useAuthStore.getState().accessToken).toBe('access-token-2');
    // setSession side-effect: refresh token persisted again.
    expect(secureStore['aisecretary.refresh-token']).toBe('refresh-token-1');
  });

  it('refresh returns null when no refresh token is stored', async () => {
    const fetchImpl = vi.fn();
    const deps = buildAuthDeps({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const token = await deps.refresh();
    expect(token).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refresh returns null and leaves state untouched when the API rejects', async () => {
    secureStore['aisecretary.refresh-token'] = 'expired-rt';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ title: 'Unauthorized' }), { status: 401 }),
      );
    const deps = buildAuthDeps({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const token = await deps.refresh();
    expect(token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('apiClient.signup parses successful AuthResponse', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(fakeAuthResponse()));
    const deps = buildAuthDeps({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const response = await deps.apiClient.signup({
      tenantName: 'Acme',
      region: 'us',
      email: 'user@example.test',
      password: 'long-enough-password',
      name: 'Example',
    });
    expect(response.user.email).toBe('user@example.test');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/v1/auth/signup',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
