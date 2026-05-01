/**
 * Mobile counterpart to apps/web/src/lib/auth/api-client.ts. Same wire
 * contract; reads the base URL from `EXPO_PUBLIC_API_URL`.
 */

import {
  type AuthResponse,
  type LoginRequest,
  type LoginResponse,
  type LogoutRequest,
  type MeResponse,
  type MfaConfirmRequest,
  type MfaDisableRequest,
  type MfaEnrollResponse,
  type MfaRecoveryCodesResponse,
  type MfaRegenerateRequest,
  type RefreshRequest,
  type SignupRequest,
  type VerifyMfaRequest,
  authResponseSchema,
  loginResponseSchema,
  meResponseSchema,
  mfaEnrollResponseSchema,
  mfaRecoveryCodesResponseSchema,
} from '@aisecretary/shared/schemas/auth';
import { type AuthFetch, type AuthFetchError, readProblemDetails } from './auth-fetch';

const DEFAULT_API_URL = 'http://localhost:3001';

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : DEFAULT_API_URL;
}

export interface ApiClientDeps {
  authFetch: AuthFetch;
  baseUrl?: string;
}

function buildUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}${path}`;
}

async function postJson<T>(
  url: string,
  body: unknown,
  fetchImpl: AuthFetch,
  parse: (input: unknown) => T,
): Promise<T> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await readProblemDetails(response);
  }
  const json = (await response.json()) as unknown;
  return parse(json);
}

export function createAuthApiClient(deps: ApiClientDeps) {
  const baseUrl = deps.baseUrl ?? resolveApiBaseUrl();
  const url = (path: string) => buildUrl(baseUrl, path);

  return {
    signup(input: SignupRequest): Promise<AuthResponse> {
      return postJson(url('/api/v1/auth/signup'), input, deps.authFetch, (data) =>
        authResponseSchema.parse(data),
      );
    },
    login(input: LoginRequest): Promise<LoginResponse> {
      return postJson(url('/api/v1/auth/login'), input, deps.authFetch, (data) =>
        loginResponseSchema.parse(data),
      );
    },
    verifyMfa(input: VerifyMfaRequest): Promise<LoginResponse> {
      return postJson(url('/api/v1/auth/login/verify-mfa'), input, deps.authFetch, (data) =>
        loginResponseSchema.parse(data),
      );
    },
    enrollMfa(): Promise<MfaEnrollResponse> {
      return postJson(url('/api/v1/auth/mfa/enroll'), {}, deps.authFetch, (data) =>
        mfaEnrollResponseSchema.parse(data),
      );
    },
    async confirmMfa(input: MfaConfirmRequest): Promise<void> {
      const response = await deps.authFetch(url('/api/v1/auth/mfa/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readProblemDetails(response);
    },
    async disableMfa(input: MfaDisableRequest): Promise<void> {
      const response = await deps.authFetch(url('/api/v1/auth/mfa/disable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await readProblemDetails(response);
    },
    regenerateRecoveryCodes(input: MfaRegenerateRequest): Promise<MfaRecoveryCodesResponse> {
      return postJson(
        url('/api/v1/auth/mfa/recovery-codes/regenerate'),
        input,
        deps.authFetch,
        (data) => mfaRecoveryCodesResponseSchema.parse(data),
      );
    },
    refresh(input: RefreshRequest): Promise<AuthResponse> {
      return postJson(url('/api/v1/auth/refresh'), input, deps.authFetch, (data) =>
        authResponseSchema.parse(data),
      );
    },
    async logout(input: LogoutRequest): Promise<void> {
      const response = await deps.authFetch(url('/api/v1/auth/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok && response.status !== 401) {
        throw await readProblemDetails(response);
      }
    },
    async me(): Promise<MeResponse> {
      const response = await deps.authFetch(url('/api/v1/auth/me'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw await readProblemDetails(response);
      }
      const json = (await response.json()) as unknown;
      return meResponseSchema.parse(json);
    },
  };
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;
export type { AuthFetchError };
