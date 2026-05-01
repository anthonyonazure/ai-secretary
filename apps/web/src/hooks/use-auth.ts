/**
 * Auth store + mutation hooks for the web client (Story 1.5a).
 *
 * State lives in a Zustand store; React Query mutations wrap the API
 * calls so callers get the standard `mutate / isPending / error` shape.
 * The auth-fetch wrapper is built once per store instance so the
 * Authorization header + 401-refresh-retry logic is wired consistently.
 *
 * Token strategy:
 *   - access token: in-memory only (state.accessToken)
 *   - refresh token: localStorage via `lib/auth/token-store.ts`
 *
 * TODO(Story 1.5e): swap the refresh token storage to an httpOnly cookie
 * once the backend issues one from /auth/refresh.
 */

import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  LoginResponse,
  MfaConfirmRequest,
  MfaDisableRequest,
  MfaRegenerateRequest,
  SignupRequest,
  VerifyMfaRequest,
} from '@aisecretary/shared/schemas/auth';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { type AuthApiClient, createAuthApiClient, resolveApiBaseUrl } from '../lib/auth/api-client';
import { type AuthFetch, type AuthFetchDeps, createAuthFetch } from '../lib/auth/auth-fetch';
// Story 1.5e — refresh token lives in an httpOnly cookie set by /api/v1/auth.
// The token-store helpers are kept as no-op compatibility shims for tests
// and any lingering call sites; this file no longer reads/writes from them.
import {} from '../lib/auth/token-store';

interface AuthStoreState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticating: boolean;
  isHydrated: boolean;
  setSession: (response: AuthResponse) => void;
  setAccessToken: (token: string | null) => void;
  setIsAuthenticating: (value: boolean) => void;
  markHydrated: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticating: false,
  isHydrated: false,
  setSession: (response) => {
    // Story 1.5e — refresh token now lives in an httpOnly cookie set by
    // the server. `response.refreshToken` is still in the body for
    // mobile callers (kept on the wire contract), but the web store
    // ignores it.
    set({
      user: response.user,
      accessToken: response.accessToken,
      isAuthenticating: false,
    });
  },
  setAccessToken: (token) => set({ accessToken: token }),
  setIsAuthenticating: (value) => set({ isAuthenticating: value }),
  markHydrated: () => set({ isHydrated: true }),
  clear: () => {
    // Story 1.5e — server-side /logout clears the refresh cookie. The
    // local store just drops the in-memory access token + user.
    set({ user: null, accessToken: null, isAuthenticating: false });
  },
}));

/**
 * Builds the auth-fetch + api-client pair for the current store instance.
 * Exported (and parametrised on the store) so tests can hand in a shim.
 */
export function buildAuthDeps(options?: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): {
  authFetch: AuthFetch;
  apiClient: AuthApiClient;
  refresh: () => Promise<string | null>;
} {
  const baseUrl = options?.baseUrl ?? resolveApiBaseUrl();
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const refresh: AuthFetchDeps['onRefresh'] = async () => {
    try {
      // Use a bare client (no auth-fetch wrapper) so we don't recurse on 401.
      // Story 1.5e — the cookie travels via `credentials: 'include'`; no body
      // payload needed. Wrap fetch to inject credentials by default since
      // the bare client doesn't go through auth-fetch.
      const credentialFetch: typeof fetch = (input, init) =>
        fetchImpl(input, { ...init, credentials: 'include' });
      const bare = createAuthApiClient({
        authFetch: credentialFetch as unknown as AuthFetch,
        baseUrl,
      });
      const response = await bare.refresh({});
      useAuthStore.getState().setSession(response);
      return response.accessToken;
    } catch {
      return null;
    }
  };

  const authFetch = createAuthFetch({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onRefresh: refresh,
    onRefreshFailure: () => useAuthStore.getState().clear(),
    fetchImpl,
  });

  const apiClient = createAuthApiClient({ authFetch, baseUrl });
  return { authFetch, apiClient, refresh };
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticating = useAuthStore((s) => s.isAuthenticating);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setSession = useAuthStore((s) => s.setSession);
  const setIsAuthenticating = useAuthStore((s) => s.setIsAuthenticating);
  const markHydrated = useAuthStore((s) => s.markHydrated);
  const clearStore = useAuthStore((s) => s.clear);

  const deps = useMemo(() => buildAuthDeps(), []);

  const signupMutation = useMutation({
    mutationFn: async (input: SignupRequest) => deps.apiClient.signup(input),
    onMutate: () => setIsAuthenticating(true),
    onSuccess: (response) => setSession(response),
    onError: () => setIsAuthenticating(false),
  });

  // Story 1.5c — login can resolve to either a session or an MFA
  // challenge. Only the `session` arm seeds the auth store; the
  // challenge arm leaves the user unauthenticated and bubbles the
  // `LoginResponse` up so the route can switch into challenge mode.
  const loginMutation = useMutation({
    mutationFn: async (input: LoginRequest): Promise<LoginResponse> => deps.apiClient.login(input),
    onMutate: () => setIsAuthenticating(true),
    onSuccess: (response) => {
      if (response.kind === 'session') {
        setSession(response);
      } else {
        // Stay un-authenticated; route handles the MFA challenge.
        setIsAuthenticating(false);
      }
    },
    onError: () => setIsAuthenticating(false),
  });

  const verifyMfaMutation = useMutation({
    mutationFn: async (input: VerifyMfaRequest): Promise<LoginResponse> =>
      deps.apiClient.verifyMfa(input),
    onMutate: () => setIsAuthenticating(true),
    onSuccess: (response) => {
      if (response.kind === 'session') {
        setSession(response);
      } else {
        setIsAuthenticating(false);
      }
    },
    onError: () => setIsAuthenticating(false),
  });

  const enrollMfaMutation = useMutation({
    mutationFn: async () => deps.apiClient.enrollMfa(),
  });

  const confirmMfaMutation = useMutation({
    mutationFn: async (input: MfaConfirmRequest): Promise<void> => deps.apiClient.confirmMfa(input),
  });

  const disableMfaMutation = useMutation({
    mutationFn: async (input: MfaDisableRequest): Promise<void> => deps.apiClient.disableMfa(input),
  });

  const regenerateRecoveryCodesMutation = useMutation({
    mutationFn: async (input: MfaRegenerateRequest) =>
      deps.apiClient.regenerateRecoveryCodes(input),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Story 1.5e — server reads the refresh cookie, revokes the
        // token, and clears the cookie via Set-Cookie on the response.
        // The cookie is included automatically because auth-fetch sets
        // `credentials: 'include'` by default.
        await deps.apiClient.logout({});
      } catch {
        // Logout failure shouldn't block the local clear.
      }
    },
    onSettled: () => clearStore(),
  });

  // One-shot hydration on mount: blindly try /refresh — the httpOnly
  // cookie either exists (user signed in last session) or doesn't (no
  // cookie ⇒ /refresh returns 401 ⇒ stay unauthenticated). We can't
  // peek at the cookie from JS by design.
  useEffect(() => {
    if (isHydrated) return;
    let cancelled = false;
    void (async () => {
      const token = await deps.refresh();
      if (cancelled) return;
      if (!token) {
        clearStore();
      }
      markHydrated();
    })();
    return () => {
      cancelled = true;
    };
  }, [deps, isHydrated, markHydrated, clearStore]);

  return {
    user,
    accessToken,
    isAuthenticating:
      isAuthenticating ||
      signupMutation.isPending ||
      loginMutation.isPending ||
      verifyMfaMutation.isPending,
    isHydrated,
    isAuthenticated: user !== null && accessToken !== null,
    signup: signupMutation.mutateAsync,
    signupError: signupMutation.error,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    logout: logoutMutation.mutateAsync,
    refresh: deps.refresh,
    // Story 1.5c — MFA flow.
    verifyMfa: verifyMfaMutation.mutateAsync,
    verifyMfaError: verifyMfaMutation.error,
    enrollMfa: enrollMfaMutation.mutateAsync,
    enrollMfaError: enrollMfaMutation.error,
    confirmMfa: confirmMfaMutation.mutateAsync,
    confirmMfaError: confirmMfaMutation.error,
    disableMfa: disableMfaMutation.mutateAsync,
    disableMfaError: disableMfaMutation.error,
    regenerateRecoveryCodes: regenerateRecoveryCodesMutation.mutateAsync,
    regenerateRecoveryCodesError: regenerateRecoveryCodesMutation.error,
  };
}
