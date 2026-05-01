/**
 * Mobile auth store + mutations (Story 1.5a).
 *
 * Same shape as the web hook but with two differences:
 *   - refresh-token persistence is async (expo-secure-store)
 *   - rehydration runs once on mount via expo-router's _layout
 *
 * TODO(Story 1.5e): swap the refresh-token storage to a backend-issued
 * cookie or a session-bound credential.
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
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from '../lib/auth/token-store';

interface AuthStoreState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticating: boolean;
  isHydrated: boolean;
  setSession: (response: AuthResponse) => Promise<void>;
  setAccessToken: (token: string | null) => void;
  setIsAuthenticating: (value: boolean) => void;
  markHydrated: () => void;
  clear: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticating: false,
  isHydrated: false,
  setSession: async (response) => {
    await saveRefreshToken(response.refreshToken);
    set({
      user: response.user,
      accessToken: response.accessToken,
      isAuthenticating: false,
    });
  },
  setAccessToken: (token) => set({ accessToken: token }),
  setIsAuthenticating: (value) => set({ isAuthenticating: value }),
  markHydrated: () => set({ isHydrated: true }),
  clear: async () => {
    await clearRefreshToken();
    set({ user: null, accessToken: null, isAuthenticating: false });
  },
}));

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
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return null;
    try {
      const bare = createAuthApiClient({
        authFetch: fetchImpl as AuthFetch,
        baseUrl,
      });
      const response = await bare.refresh({ refreshToken });
      await useAuthStore.getState().setSession(response);
      return response.accessToken;
    } catch {
      return null;
    }
  };

  const authFetch = createAuthFetch({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onRefresh: refresh,
    onRefreshFailure: () => {
      void useAuthStore.getState().clear();
    },
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
    onSuccess: async (response) => {
      await setSession(response);
    },
    onError: () => setIsAuthenticating(false),
  });

  // Story 1.5c — discriminated login response (session | mfa-required).
  const loginMutation = useMutation({
    mutationFn: async (input: LoginRequest): Promise<LoginResponse> => deps.apiClient.login(input),
    onMutate: () => setIsAuthenticating(true),
    onSuccess: async (response) => {
      if (response.kind === 'session') {
        await setSession(response);
      } else {
        setIsAuthenticating(false);
      }
    },
    onError: () => setIsAuthenticating(false),
  });

  const verifyMfaMutation = useMutation({
    mutationFn: async (input: VerifyMfaRequest): Promise<LoginResponse> =>
      deps.apiClient.verifyMfa(input),
    onMutate: () => setIsAuthenticating(true),
    onSuccess: async (response) => {
      if (response.kind === 'session') {
        await setSession(response);
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
    mutationFn: async (input: MfaConfirmRequest) => deps.apiClient.confirmMfa(input),
  });

  const disableMfaMutation = useMutation({
    mutationFn: async (input: MfaDisableRequest) => deps.apiClient.disableMfa(input),
  });

  const regenerateRecoveryCodesMutation = useMutation({
    mutationFn: async (input: MfaRegenerateRequest) =>
      deps.apiClient.regenerateRecoveryCodes(input),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = await loadRefreshToken();
      if (refreshToken) {
        try {
          await deps.apiClient.logout({ refreshToken });
        } catch {
          // best-effort
        }
      }
    },
    onSettled: async () => {
      await clearStore();
    },
  });

  useEffect(() => {
    if (isHydrated) return;
    let cancelled = false;
    void (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) {
        markHydrated();
        return;
      }
      const token = await deps.refresh();
      if (cancelled) return;
      if (!token) {
        await clearStore();
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
    // Story 1.5c — MFA.
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
