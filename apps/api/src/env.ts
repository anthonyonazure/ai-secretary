import { z } from 'zod';

/**
 * Environment loader for `apps/api`.
 *
 * Validation runs at boot via `loadEnv()` — fail-closed: missing/bad values
 * crash the process before Fastify starts. Tests inject overrides through
 * `buildServer({ env })` instead of mutating `process.env`.
 *
 * Story 1.5 (auth) will replace the `JWT_SECRET` placeholder with the real
 * verified-claim plumbing.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Region this api instance serves. Region-pinned per architecture.md. */
  REGION: z.enum(['us', 'eu']).default('us'),
  /** Postgres URL — wired into `@aisecretary/db` once Story 1.5+ open routes. */
  DATABASE_URL: z.string().url().default('postgres://localhost:5432/aisecretary_dev'),
  /**
   * Redis URL — used by `@aisecretary/auth`'s `RedisRefreshTokenStore`.
   * When unset, the server falls back to an in-memory store (single-
   * instance dev only). Production must set this.
   */
  REDIS_URL: z.string().url().optional(),
  /**
   * JWT secret — validated here so the env loader is the single point of
   * truth. The `jwt` plugin in `apps/api` uses this for HS256.
   */
  JWT_SECRET: z.string().min(32).default('dev-secret-min-32-chars-replace-me-please'),
  /**
   * Story 1.5c — secret for the short-lived MFA challenge JWT
   * (`/auth/login` → `/auth/login/verify-mfa`). Distinct from
   * `JWT_SECRET` so a leaked challenge can never be confused with a
   * session token.
   */
  JWT_MFA_CHALLENGE_SECRET: z
    .string()
    .min(32)
    .default('dev-mfa-challenge-secret-min-32-chars-replace-me'),
  /**
   * Story 1.5c — 32-byte (64-hex) AES-256-GCM key for at-rest encryption
   * of the per-user TOTP secret (`users.mfa_secret_encrypted`).
   * Optional in dev — fail-closed in production via
   * `assertMfaEncryptionKey()` at boot.
   */
  MFA_SECRET_ENCRYPTION_KEY: z.string().optional(),
  /** Story 1.5b — OAuth client credentials. All optional; routes return
   *  503 when a provider is not configured. */
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_ID: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional(),
  /** Origin used to build provider redirect URIs + post-callback SPA
   *  landing. Must match what's registered with each provider. */
  OAUTH_REDIRECT_BASE_URL: z.string().url().default('http://localhost:3001'),
  /** Pino log level. */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /** S3 bucket for recording audio. Mirrors apps/workers + apps/bot. */
  S3_BUCKET: z.string().min(1).default('aisecretary-recordings-local'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  /** Optional S3 endpoint override (MinIO / LocalStack / R2). */
  S3_ENDPOINT: z.string().url().optional(),
  /** Force path-style addressing (for MinIO / LocalStack). */
  S3_FORCE_PATH_STYLE: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),

  /**
   * Public-facing app base URL. Used to format share links (`/share/:token`),
   * accept-invite URLs (`/invites/:token/accept`), and DSAR portal links.
   */
  APP_BASE_URL: z.string().url().default('http://localhost:3001'),

  /**
   * Anthropic API key — when set, the chat route's RAG streamer goes
   * through `AnthropicProvider`. Unset → mock streamer (deterministic
   * word-at-a-time reply built from retrieved context). The chat
   * surface still works in either mode; the mock is faithful to the
   * retrieval pipeline so the citation chips + faithfulness banners
   * exercise the same code paths.
   */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Optional Anthropic model override. Defaults to claude-sonnet-4-6. */
  ANTHROPIC_MODEL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
};
