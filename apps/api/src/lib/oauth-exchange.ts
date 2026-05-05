/**
 * Real OAuth code-exchange + ID-token verification — Story 1.5b.
 *
 * Implements the federated-login path for Google + Microsoft. The flow:
 *
 *   1. Exchange the auth code at the provider's token endpoint
 *      (`oauth2.googleapis.com/token` /
 *      `login.microsoftonline.com/.../oauth2/v2.0/token`).
 *   2. Verify the provider's ID token (signature via JWKS, issuer +
 *      audience claims) — `jose`.
 *   3. Find the user by the ID-token email claim. If they exist, mint
 *      a session via the existing password-auth helpers. If they don't,
 *      return null — federated SIGN-UP requires an admin invite (FR-
 *      consent: tenant-bound onboarding lives behind the F2-admin DPA
 *      gate, not behind a stranger's Google login).
 *
 * Security notes:
 *   - The ID token's signature is verified via `jose.createRemoteJWKSet`
 *     against the provider's JWKS; the `kid` is honored. Issuer +
 *     audience are checked. Tokens older than 5 minutes are rejected.
 *   - The access token returned by the provider is intentionally NOT
 *     persisted — we authenticate the user via their email + verified
 *     identity assertion, not their provider grants. (Provider grants
 *     are scoped to providers themselves; AI Secretary's session is
 *     ours.)
 *
 * Test seam: `httpFetcher` and `jwksFetcherFactory` are injectable so
 * the test suite can stub provider HTTP calls without a network.
 */

import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

import type { AuthRepository } from '../routes/auth-repository.js';
import { issueSessionAndPersist } from '../routes/auth.js';
import type { AuthRoutesOptions } from '../routes/auth.js';
import type { OauthExchangeFn, OauthExchangeFnInput } from '../routes/oauth.js';

export type OauthFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface OauthProviderEndpoints {
  /** Provider's OAuth token endpoint. */
  tokenUrl: string;
  /** JWKS URL for ID-token signature verification. */
  jwksUrl: string;
  /** Expected `iss` claim on the ID token. */
  issuer: string;
}

export const OAUTH_ENDPOINTS: Record<'google' | 'microsoft', OauthProviderEndpoints> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
  },
  microsoft: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    // Microsoft v2.0 issuer is templated by tenant id — we accept any
    // issuer that starts with this prefix during verification.
    issuer: 'https://login.microsoftonline.com/',
  },
};

interface IdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  name?: string;
  sub?: string;
}

export interface HttpOauthExchangeDeps {
  authRepository: AuthRepository;
  authRoutesOptions: AuthRoutesOptions;
  /** Provider client credentials. Maps to OauthRoutesOptions.providers. */
  providers: {
    google?: { clientId: string; clientSecret: string };
    microsoft?: { clientId: string; clientSecret: string };
  };
  /** Override fetch for tests. */
  httpFetcher?: OauthFetcher;
  /** Factory for the JWKS resolver. Override in tests with a stub that
   *  returns a static key. */
  jwksFetcherFactory?: (url: URL) => ReturnType<typeof createRemoteJWKSet>;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

const isMicrosoftIssuer = (iss: unknown): boolean =>
  typeof iss === 'string' && iss.startsWith(OAUTH_ENDPOINTS.microsoft.issuer);

const verifyClaims = (
  provider: 'google' | 'microsoft',
  payload: IdTokenClaims,
  expectedAudience: string,
): void => {
  const endpoints = OAUTH_ENDPOINTS[provider];
  if (provider === 'microsoft') {
    if (!isMicrosoftIssuer(payload.iss)) {
      throw new Error(`unexpected issuer: ${String(payload.iss)}`);
    }
  } else if (payload.iss !== endpoints.issuer) {
    throw new Error(`unexpected issuer: ${String(payload.iss)}`);
  }
  // jose verifies `aud` when passed via options, but we double-check
  // here so the path can be inspected.
  const aud = payload.aud;
  const audMatches = Array.isArray(aud) ? aud.includes(expectedAudience) : aud === expectedAudience;
  if (!audMatches) {
    throw new Error('audience mismatch');
  }
};

const exchangeCodeForTokens = async (
  provider: 'google' | 'microsoft',
  args: {
    code: string;
    codeVerifier?: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  },
  fetcher: OauthFetcher,
): Promise<TokenResponse> => {
  const endpoints = OAUTH_ENDPOINTS[provider];
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    ...(args.codeVerifier ? { code_verifier: args.codeVerifier } : {}),
  });
  const res = await fetcher(endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`token-exchange failed: ${res.status} ${errBody.slice(0, 200)}`);
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.id_token) throw new Error('token-exchange response missing id_token');
  return json;
};

/**
 * Build the production `OauthExchangeFn`. Returns `null` when the user
 * doesn't exist (caller surfaces 401); throws on infrastructure errors
 * (caller surfaces 500).
 */
export const buildHttpOauthExchange = (deps: HttpOauthExchangeDeps): OauthExchangeFn => {
  const fetcher = deps.httpFetcher ?? fetch;
  const jwksFactory = deps.jwksFetcherFactory ?? createRemoteJWKSet;
  // Lazy-built JWKS sets — created once per provider on first use.
  const jwksCache: Partial<Record<'google' | 'microsoft', ReturnType<typeof createRemoteJWKSet>>> =
    {};

  return async (input: OauthExchangeFnInput) => {
    if (input.provider !== 'google' && input.provider !== 'microsoft') return null;
    const cfg = deps.providers[input.provider];
    if (!cfg) return null;

    const tokens = await exchangeCodeForTokens(
      input.provider,
      {
        code: input.code,
        ...(input.codeVerifier ? { codeVerifier: input.codeVerifier } : {}),
        redirectUri: input.redirectUri,
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
      },
      fetcher,
    );

    if (!jwksCache[input.provider]) {
      jwksCache[input.provider] = jwksFactory(new URL(OAUTH_ENDPOINTS[input.provider].jwksUrl));
    }
    const jwks = jwksCache[input.provider];
    if (!jwks) throw new Error('jwks unavailable');

    const { payload } = await jwtVerify<IdTokenClaims>(tokens.id_token, jwks, {
      audience: cfg.clientId,
      maxTokenAge: '5m',
      ...(input.provider === 'google' ? { issuer: OAUTH_ENDPOINTS.google.issuer } : {}),
    });
    verifyClaims(input.provider, payload, cfg.clientId);

    const email = payload.email ?? payload.preferred_username;
    if (!email) throw new Error('id token missing email claim');
    if (input.provider === 'google' && payload.email_verified !== true) {
      throw new Error('google email not verified');
    }

    const user = await deps.authRepository.findUserByEmail(email);
    if (!user) {
      // Federated sign-IN only — sign-UP requires the F2-admin invite
      // flow (ADR-0004). Surface as null → caller returns 401.
      return null;
    }

    const tenant = await deps.authRepository.findTenantById(user.tenantId);
    if (!tenant) return null;

    const auth = await issueSessionAndPersist(user, tenant.region, deps.authRoutesOptions);
    return { ...auth, created: false };
  };
};
