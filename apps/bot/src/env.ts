/**
 * Environment loader for `apps/bot`.
 *
 * Mirrors `apps/workers/src/env.ts` — fail-closed validation at boot.
 *
 * The bot service is region-pinned via `REGION`. Zoom/Teams SDK
 * credentials are intentionally optional: when unset, `selectBotProviderKind`
 * still routes to the mock provider in `MODE=dev|test`, and provider
 * construction in `MODE=production` for the matching source will fail
 * with `BotProviderUnavailableError` (cred-validating constructors —
 * see packages/bot/src/providers/{zoom,teams}.ts). This keeps the
 * service bootable today against the mock provider while real creds are
 * landing per-region.
 */

import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REGION: z.enum(['us', 'eu']).default('us'),
  /**
   * `mode` drives `selectBotProviderKind` independently of NODE_ENV so
   * a CI smoke can boot the production wiring against MockBotProvider.
   * Defaults: NODE_ENV=production → mode=production, otherwise → mode=dev.
   */
  MODE: z.enum(['production', 'dev', 'test']).optional(),
  DATABASE_URL: z.string().url().default('postgres://localhost:5432/aisecretary_dev'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /** pg-boss concurrency for `bot.join`. Each job runs for hours, so 1–2 is correct. */
  BOT_JOIN_CONCURRENCY: z.coerce.number().int().positive().default(1),

  /** Hard upper bound on a single session. Default 4h, configurable per env. */
  BOT_SESSION_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(4 * 60 * 60 * 1000),

  /** Display name the bot uses when joining. */
  BOT_DISPLAY_NAME: z.string().min(1).default('AI Secretary'),

  /**
   * Disclosure copy spoken on join (TTS) + posted in chat. Compliance
   * substrate ensures every region has a localized default; this env
   * var is the production override.
   */
  BOT_DISCLOSURE_TEXT: z
    .string()
    .min(1)
    .default(
      'This meeting is being recorded by AI Secretary so participants can review the transcript and decisions afterwards.',
    ),

  /** S3 bucket for recording audio. Mirrors apps/workers. */
  S3_BUCKET: z.string().min(1).default('aisecretary-recordings-local'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),

  /**
   * Redis URL — required for the heartbeat publisher. The bot service
   * republishes `heartbeat:bot:<sessionId>` every 30s (TTL 90s); the
   * cross-tenant `bot-watchdog` worker reads the same keys. When
   * REDIS_URL is unset, the boot logs a warning and uses an in-memory
   * heartbeat publisher (the watchdog won't see the keys, so production
   * MUST set this).
   */
  REDIS_URL: z.string().url().optional(),

  /** Zoom Server-to-Server OAuth credentials. Per-region. */
  ZOOM_ACCOUNT_ID: z.string().min(1).optional(),
  ZOOM_CLIENT_ID: z.string().min(1).optional(),
  ZOOM_CLIENT_SECRET: z.string().min(1).optional(),

  /** Microsoft Graph (Teams) app-only credentials. Per-region. */
  TEAMS_TENANT_ID: z.string().min(1).optional(),
  TEAMS_CLIENT_ID: z.string().min(1).optional(),
  TEAMS_CLIENT_SECRET: z.string().min(1).optional(),
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

export const resolveMode = (env: Env): 'production' | 'dev' | 'test' => {
  if (env.MODE) return env.MODE;
  if (env.NODE_ENV === 'production') return 'production';
  if (env.NODE_ENV === 'test') return 'test';
  return 'dev';
};
