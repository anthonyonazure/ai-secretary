import { createHash, randomBytes } from 'node:crypto';

import {
  type OauthExchangeResponse,
  type OauthProvider,
  type OauthStartResponse,
  oauthCallbackQuerySchema,
  oauthExchangeRequestSchema,
  oauthExchangeResponseSchema,
  oauthProviderSchema,
  oauthStartResponseSchema,
} from '@aisecretary/shared/schemas/oauth';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';

/**
 * Story 1.5b — OAuth scaffold (Google + Microsoft).
 *
 * SCAFFOLD ONLY: the routes ship with the right URL/contract shape so
 * mobile + web can wire against them today. The actual ID-token
 * verification + user upsert lives in the injected `OauthExchangeFn`,
 * which is currently a no-op stub. Production wires the real exchange
 * (using `jose` to verify Google/Microsoft JWKS) once Anthony provides
 * client IDs + secrets via env.
 */

export type OauthExchangeFn = (input: {
  provider: OauthProvider;
  code: string;
  codeVerifier?: string;
  redirectUri: string;
}) => Promise<OauthExchangeResponse | null>;

export interface OauthRoutesOptions {
  /**
   * Configured providers. When a provider's clientId is empty, the
   * route returns 503 — callers can detect "OAuth not yet configured"
   * cleanly without crashing the route registration.
   */
  providers: Record<
    OauthProvider,
    {
      clientId: string;
      clientSecret: string;
      authorizeUrl: string;
      scopes: ReadonlyArray<string>;
    }
  >;
  redirectBaseUrl: string;
  /** Pluggable exchange fn — production injects the JWKS-verifying impl. */
  exchange: OauthExchangeFn;
  /** Override the state-token TTL (tests). 10 min default. */
  stateTtlSeconds?: number;
}

/**
 * In-memory state store. Production swaps for Redis (matching the
 * refresh-token store pattern) — small follow-up; the in-memory variant
 * is fine for single-instance dev + tests.
 */
class OauthStateStore {
  private readonly entries = new Map<string, { provider: OauthProvider; expiresAt: number }>();

  put(state: string, provider: OauthProvider, ttlSeconds: number): void {
    this.entries.set(state, { provider, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  consume(state: string, provider: OauthProvider): boolean {
    const entry = this.entries.get(state);
    if (!entry) return false;
    this.entries.delete(state);
    if (entry.provider !== provider) return false;
    if (entry.expiresAt < Date.now()) return false;
    return true;
  }
}

const DEFAULT_STATE_TTL = 10 * 60;
const STATE_BYTES = 32;

const generateState = (): string => randomBytes(STATE_BYTES).toString('base64url');

const generatePkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

const buildRedirectUri = (baseUrl: string, provider: OauthProvider): string =>
  `${baseUrl.replace(/\/$/, '')}/api/v1/auth/oauth/${provider}/callback`;

const buildAuthorizationUrl = (
  provider: OauthProvider,
  cfg: OauthRoutesOptions['providers'][OauthProvider],
  state: string,
  codeChallenge: string,
  redirectUri: string,
): string => {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  return `${cfg.authorizeUrl}?${params.toString()}`;
};

export const oauthRoutes = (options: OauthRoutesOptions): FastifyPluginAsync => {
  const stateStore = new OauthStateStore();
  const stateTtl = options.stateTtlSeconds ?? DEFAULT_STATE_TTL;
  // PKCE verifier is held alongside state so the callback can pass it
  // through to the exchange — same lifetime as state.
  const verifierStore = new Map<string, string>();

  return async (fastify) => {
    /**
     * GET /api/v1/auth/oauth/:provider/start — kick off the flow.
     * Returns the authorize URL the client redirects to (web) or opens
     * via the platform browser (mobile).
     */
    fastify.get<{ Params: { provider: string } }>(
      '/oauth/:provider/start',
      { config: { skipTenantContext: true, skipAudit: true } },
      async (request: FastifyRequest, reply) => {
        const provider = oauthProviderSchema.safeParse(
          (request.params as { provider: string }).provider,
        );
        if (!provider.success) {
          throw new ValidationError('Unknown OAuth provider.');
        }
        const cfg = options.providers[provider.data];
        if (!cfg.clientId || !cfg.clientSecret) {
          return reply.status(503).send({
            type: 'about:blank',
            title: 'OAuth not configured',
            status: 503,
            detail: `OAuth provider '${provider.data}' is not configured on this deployment.`,
          });
        }

        const state = generateState();
        const { verifier, challenge } = generatePkce();
        const redirectUri = buildRedirectUri(options.redirectBaseUrl, provider.data);
        stateStore.put(state, provider.data, stateTtl);
        verifierStore.set(state, verifier);

        const authorizationUrl = buildAuthorizationUrl(
          provider.data,
          cfg,
          state,
          challenge,
          redirectUri,
        );
        const response: OauthStartResponse = {
          authorizationUrl,
          state,
          expiresAt: new Date(Date.now() + stateTtl * 1000).toISOString(),
        };
        return reply.send(oauthStartResponseSchema.parse(response));
      },
    );

    /**
     * GET /api/v1/auth/oauth/:provider/callback — provider redirects here
     * with `code` + `state`. Validates state, exchanges code, sets cookie,
     * redirects the browser to the SPA with a session bootstrap token.
     */
    fastify.get<{
      Params: { provider: string };
      Querystring: { code?: string; state?: string };
    }>(
      '/oauth/:provider/callback',
      { config: { skipTenantContext: true, skipAudit: true } },
      async (request: FastifyRequest, reply) => {
        const provider = oauthProviderSchema.safeParse(
          (request.params as { provider: string }).provider,
        );
        if (!provider.success) throw new ValidationError('Unknown OAuth provider.');
        const query = oauthCallbackQuerySchema.safeParse(request.query);
        if (!query.success) throw new ValidationError('Missing code or state.');

        if (!stateStore.consume(query.data.state, provider.data)) {
          throw new ForbiddenError('OAuth state invalid or expired.');
        }
        const verifier = verifierStore.get(query.data.state);
        verifierStore.delete(query.data.state);

        const result = await options.exchange({
          provider: provider.data,
          code: query.data.code,
          ...(verifier ? { codeVerifier: verifier } : {}),
          redirectUri: buildRedirectUri(options.redirectBaseUrl, provider.data),
        });
        if (!result) {
          throw new UnauthorizedError('OAuth exchange failed.');
        }
        // Browser-redirect form: front-end captures the cookie + does
        // /me to bootstrap the session. The SPA path below mirrors the
        // signup/login post-auth landing.
        return reply.redirect(`${options.redirectBaseUrl.replace(/\/$/, '')}/oauth/landing`);
      },
    );

    /**
     * POST /api/v1/auth/oauth/:provider/exchange — direct exchange used
     * by mobile (expo-auth-session yields a code; client POSTs it here).
     * Body: { code, codeVerifier?, redirectUri? }. Response: AuthResponse + created.
     */
    fastify.post<{
      Params: { provider: string };
      Body: { code: string; codeVerifier?: string; redirectUri?: string };
    }>(
      '/oauth/:provider/exchange',
      { config: { skipTenantContext: true, skipAudit: true } },
      async (request: FastifyRequest, reply) => {
        const provider = oauthProviderSchema.safeParse(
          (request.params as { provider: string }).provider,
        );
        if (!provider.success) throw new ValidationError('Unknown OAuth provider.');
        const parsed = oauthExchangeRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid exchange payload');
        }
        const cfg = options.providers[provider.data];
        if (!cfg.clientId || !cfg.clientSecret) {
          return reply.status(503).send({
            type: 'about:blank',
            title: 'OAuth not configured',
            status: 503,
            detail: `OAuth provider '${provider.data}' is not configured on this deployment.`,
          });
        }

        const result = await options.exchange({
          provider: provider.data,
          code: parsed.data.code,
          ...(parsed.data.codeVerifier !== undefined
            ? { codeVerifier: parsed.data.codeVerifier }
            : {}),
          redirectUri:
            parsed.data.redirectUri ?? buildRedirectUri(options.redirectBaseUrl, provider.data),
        });
        if (!result) {
          throw new UnauthorizedError('OAuth exchange failed.');
        }
        return reply.status(200).send(oauthExchangeResponseSchema.parse(result));
      },
    );
  };
};

/**
 * Default exchange stub — returns null until production wires the real
 * JWKS-verifying impl. Intentionally exported so tests can swap.
 */
export const noopOauthExchange: OauthExchangeFn = async () => null;

/** Helper to read provider configs from env vars at server boot. */
export const oauthProvidersFromEnv = (env: {
  GOOGLE_OAUTH_CLIENT_ID?: string | undefined;
  GOOGLE_OAUTH_CLIENT_SECRET?: string | undefined;
  MICROSOFT_OAUTH_CLIENT_ID?: string | undefined;
  MICROSOFT_OAUTH_CLIENT_SECRET?: string | undefined;
}): OauthRoutesOptions['providers'] => ({
  google: {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['openid', 'email', 'profile'],
  },
  microsoft: {
    clientId: env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
    clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
  },
});
