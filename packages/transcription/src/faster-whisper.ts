import { z } from 'zod';
import { TranscriptionProviderError, TranscriptionTimeoutError } from './errors.js';
import {
  DEFAULT_TRANSCRIBE_TIMEOUT_MS,
  type TranscriptionProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionSegment,
} from './types.js';

/**
 * Self-hosted faster-whisper HTTP provider.
 *
 * `faster-whisper` is a CTranslate2 reimplementation of Whisper that
 * runs on commodity GPUs. We deploy it as an internal HTTP service
 * inside each tenant's region (see `infra/faster-whisper/` — wired in
 * a future story). The endpoint URL is provided per-environment via
 * `FASTER_WHISPER_URL`; this provider never hardcodes a URL (CLAUDE.md
 * § Anti-Patterns: "Hardcoded provider URLs / endpoints anywhere").
 *
 * Wire format:
 *   POST {endpoint}/transcribe
 *   Content-Type: application/json
 *   { "audioUrl": "...", "language": "en", "contentType": "audio/webm" }
 *
 *   200 OK:
 *   {
 *     "segments": [
 *       { "startMs": 0, "endMs": 5000, "text": "...", "confidence": 0.93 }
 *     ],
 *     "detectedLanguage": "en",
 *     "durationMs": 30000
 *   }
 *
 * `speaker` is intentionally absent from the wire format in Story 2.2 —
 * the provider always sets `speaker: null` regardless of what the
 * service returns. Story 2.3 will introduce a typed `speaker` field
 * that flows through.
 */

export interface FasterWhisperProviderConfig {
  /** Base URL of the faster-whisper service, e.g. `http://faster-whisper:8000`. */
  endpoint: string;
  /** Optional override of the default 30s timeout. */
  timeoutMs?: number;
  /**
   * Optional override for tests. Default uses global `fetch`. Tests can
   * supply a vitest `vi.fn()` that returns a stubbed `Response`.
   */
  fetch?: typeof fetch;
  /**
   * Optional bearer token for the self-hosted service (some deployments
   * sit behind a shared-secret proxy). Sent as `Authorization: Bearer …`
   * when present.
   */
  authToken?: string;
}

const PROVIDER_KIND = 'faster-whisper' as const;

const wireSegmentSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

const wireResponseSchema = z.object({
  segments: z.array(wireSegmentSchema),
  detectedLanguage: z.string(),
  durationMs: z.number().int().nonnegative(),
});

export class FasterWhisperProvider implements TranscriptionProvider {
  readonly kind = 'faster-whisper' as const;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly authToken: string | undefined;

  constructor(config: FasterWhisperProviderConfig) {
    if (!config.endpoint) {
      throw new TranscriptionProviderError(
        PROVIDER_KIND,
        'endpoint is required (configure FASTER_WHISPER_URL)',
      );
    }
    // Strip a trailing slash so we don't double up later.
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TRANSCRIBE_TIMEOUT_MS;
    this.fetchImpl = config.fetch ?? fetch;
    this.authToken = config.authToken;
  }

  async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (this.authToken !== undefined) {
        headers.authorization = `Bearer ${this.authToken}`;
      }
      const response = await this.fetchImpl(`${this.endpoint}/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audioUrl: input.audioUrl,
          contentType: input.contentType,
          ...(input.language !== undefined ? { language: input.language } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '<unreadable>');
        throw new TranscriptionProviderError(
          PROVIDER_KIND,
          `endpoint returned ${response.status}: ${text.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as unknown;
      const parsed = wireResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new TranscriptionProviderError(
          PROVIDER_KIND,
          `endpoint returned malformed payload: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        );
      }

      const segments: TranscriptionSegment[] = parsed.data.segments
        .map((s): TranscriptionSegment | null => {
          const text = s.text.trim();
          if (text.length === 0) return null;
          return {
            startMs: s.startMs,
            endMs: s.endMs,
            text,
            confidence: s.confidence,
            // TODO(Story 2.3): diarization via Pyannote pass — when the
            // self-hosted service grows native diarization support, the
            // wire format adds `speaker` and we forward it here.
            speaker: null,
          };
        })
        .filter((s): s is TranscriptionSegment => s !== null);

      return {
        segments,
        detectedLanguage: parsed.data.detectedLanguage,
        durationMs: parsed.data.durationMs,
      };
    } catch (err) {
      if (controller.signal.aborted) {
        throw new TranscriptionTimeoutError(this.timeoutMs, err);
      }
      if (err instanceof TranscriptionProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new TranscriptionProviderError(PROVIDER_KIND, message, err);
    } finally {
      clearTimeout(timeout);
    }
  }
}
