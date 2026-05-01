import { z } from 'zod';

import { authResponseSchema } from './auth.js';

/**
 * Story 1.5b — OAuth wire contract (Google + Microsoft).
 *
 * Flow: client GET /auth/oauth/:provider/start → 302 redirect to provider's
 * consent screen with `state` (CSRF) + `redirect_uri`. Provider redirects
 * back to /auth/oauth/:provider/callback with `code` + `state`. Server
 * validates state, exchanges code for ID token, upserts the user, issues
 * an AI-Secretary session JWT pair (same shape as /auth/login) and sets
 * the httpOnly refresh cookie.
 *
 * Mobile: native auth via `expo-auth-session` produces the same `code`,
 * which the client POSTs to /auth/oauth/:provider/exchange (the route
 * exchanges the code server-side so the client never sees the client
 * secret).
 *
 * Identity link table `auth_identities` stores
 * `(provider, provider_user_id) → users.id` so a user with the same
 * email + Google + Microsoft can sign in via any of them. Created on
 * first OAuth callback; future stories layer account-linking UI on top.
 */

export const oauthProviderSchema = z.enum(['google', 'microsoft']);
export type OauthProvider = z.infer<typeof oauthProviderSchema>;

export const oauthStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string().min(16),
  expiresAt: z.string().datetime(),
});
export type OauthStartResponse = z.infer<typeof oauthStartResponseSchema>;

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type OauthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

/** Mobile direct-exchange variant — same response shape as /auth/login. */
export const oauthExchangeRequestSchema = z.object({
  code: z.string().min(1),
  /** PKCE verifier, when present (Expo native auth uses PKCE). */
  codeVerifier: z.string().optional(),
  /** Override redirect URI from default — only honored when matching the
   *  registered allowlist server-side. */
  redirectUri: z.string().url().optional(),
});
export type OauthExchangeRequest = z.infer<typeof oauthExchangeRequestSchema>;

export const oauthExchangeResponseSchema = authResponseSchema.extend({
  /** True when the OAuth flow CREATED a new user; false on subsequent
   *  sign-ins. UI distinguishes "welcome" vs "welcome back". */
  created: z.boolean(),
});
export type OauthExchangeResponse = z.infer<typeof oauthExchangeResponseSchema>;
