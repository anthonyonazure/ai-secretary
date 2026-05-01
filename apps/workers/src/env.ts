import { z } from 'zod';

/**
 * Environment loader for `apps/workers`.
 *
 * Mirrors apps/api/src/env.ts — fail-closed validation at boot. Workers
 * read fewer surfaces (no JWT, no Redis) but share DB + region.
 *
 * Story 2.2 additions:
 *   - `OPENAI_API_KEY` (optional) — when unset, the transcribe handler
 *     falls back to a `MockTranscriptionProvider` for whisper-api routing.
 *     This keeps dev/CI runs working without a real key.
 *   - `FASTER_WHISPER_URL` (optional) — same fallback semantics for
 *     faster-whisper routing (HIPAA / EU / BYOK tenants).
 *   - `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` —
 *     storage configuration for the worker-side `StorageProvider`. The
 *     worker needs presignGet to hand the audio URL to the engine.
 *   - `TRANSCRIBE_TIMEOUT_MS` (optional) — per-call timeout override.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REGION: z.enum(['us', 'eu']).default('us'),
  DATABASE_URL: z.string().url().default('postgres://localhost:5432/aisecretary_dev'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  /** Concurrency per worker queue. */
  TRANSCRIBE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  /** OpenAI Whisper API key. Optional — falls back to mock when unset. */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** Self-hosted faster-whisper endpoint. Optional — falls back to mock. */
  FASTER_WHISPER_URL: z.string().url().optional(),
  /** Per-call transcription timeout. Optional. */
  TRANSCRIBE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  /** S3 bucket for recording audio. */
  S3_BUCKET: z.string().min(1).default('aisecretary-recordings-local'),
  /** S3 region (default mirrors REGION when unset). */
  S3_REGION: z.string().min(1).default('us-east-1'),
  /** Optional S3 endpoint override (MinIO / LocalStack / R2). */
  S3_ENDPOINT: z.string().url().optional(),
  /** Force path-style addressing (for MinIO / LocalStack). */
  S3_FORCE_PATH_STYLE: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  /**
   * Redis URL — used by the Story 4.4 watchdog to read heartbeat keys
   * (set by the API's `/recordings/:id/heartbeat` route). When unset,
   * the worker boots without the watchdog scheduled. Production must
   * set this for the lost-ping detection path.
   */
  REDIS_URL: z.string().url().optional(),
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
