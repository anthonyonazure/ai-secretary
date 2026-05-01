import OpenAI from 'openai';
import { TranscriptionProviderError, TranscriptionTimeoutError } from './errors.js';
import {
  DEFAULT_TRANSCRIBE_TIMEOUT_MS,
  type TranscriptionProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionSegment,
} from './types.js';

/**
 * OpenAI Whisper API provider.
 *
 * This is the ONLY file in the workspace allowed to import the `openai`
 * SDK for transcription. The provider-isolation grep (see
 * `packages/transcription/scripts/check-isolation.ts`) enforces this.
 *
 * Confidence derivation:
 *   The Whisper API's `verbose_json` response includes a per-segment
 *   `avg_logprob` field (the mean per-token log-probability). For clean
 *   audio it ranges roughly [-1.0, 0.0]; very low quality audio dips
 *   into [-3.0, -1.0]. There is no documented "confidence" field, so we
 *   project log-prob into [0, 1] with a clamped affine map:
 *
 *     confidence = clamp(0, 1, 1 + avg_logprob / 10)
 *
 *   At avg_logprob = 0   → confidence ≈ 1.0  (very confident)
 *   At avg_logprob = -2  → confidence ≈ 0.8
 *   At avg_logprob = -5  → confidence ≈ 0.5
 *   At avg_logprob = -10 → confidence ≈ 0.0  (definitely uncertain)
 *
 *   The /10 divisor is a heuristic — picked so common log-probs land
 *   in the middle/upper band of [0, 1]. We don't claim this is a
 *   well-calibrated probability; downstream consumers (UI badges,
 *   re-transcribe heuristics) treat it as "higher = more confident,
 *   compare against a single threshold, do not interpret as a
 *   true probability".
 *
 * Diarization: Whisper API does not return speaker labels.
 * Story 2.2 emits `speaker: null` for every segment.
 */

export interface WhisperApiProviderConfig {
  apiKey: string;
  /** Optional override for tests + non-default deployments. */
  baseURL?: string;
  /** Optional override of the default 30s timeout. */
  timeoutMs?: number;
  /**
   * Pre-built client (tests). When provided, `apiKey` / `baseURL` are
   * ignored — the test injects its own mocked SDK.
   */
  client?: OpenAI;
  /**
   * Override the audio-fetch step (tests). Default uses global `fetch`.
   * Returns a `Blob` with a `.name` attribute that the SDK uses for
   * the multipart filename + content-type detection.
   */
  fetchAudio?: (audioUrl: string, contentType: string) => Promise<File | Blob>;
}

const PROVIDER_KIND = 'whisper-api' as const;
const MODEL = 'whisper-1';
const LOGPROB_DIVISOR = 10;

/** Clamp `value` into [min, max]. */
const clamp = (min: number, max: number, value: number): number =>
  Math.max(min, Math.min(max, value));

/** Map Whisper API `avg_logprob` to [0, 1] confidence. See file header. */
export const logprobToConfidence = (avgLogprob: number | undefined): number => {
  if (avgLogprob === undefined || Number.isNaN(avgLogprob)) return 0;
  return clamp(0, 1, 1 + avgLogprob / LOGPROB_DIVISOR);
};

/**
 * Default audio-fetch implementation. Pulls the audio bytes from the
 * presigned URL and wraps them in a `File` so the OpenAI SDK can
 * forward as a multipart upload.
 */
const defaultFetchAudio = async (audioUrl: string, contentType: string): Promise<File> => {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new TranscriptionProviderError(
      PROVIDER_KIND,
      `audio fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  // The Whisper API auto-detects the format from the file extension or
  // mime type; `audio.bin` works as long as the mime type is set.
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'bin';
  return new File([buffer], `audio.${ext}`, { type: contentType });
};

interface VerboseJsonSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
}

interface VerboseJsonResponse {
  duration?: number;
  language?: string;
  segments?: VerboseJsonSegment[];
}

export class WhisperApiProvider implements TranscriptionProvider {
  readonly kind = 'whisper-api' as const;
  private readonly client: OpenAI;
  private readonly timeoutMs: number;
  private readonly fetchAudio: (audioUrl: string, contentType: string) => Promise<File | Blob>;

  constructor(config: WhisperApiProviderConfig) {
    this.client =
      config.client ??
      new OpenAI({
        apiKey: config.apiKey,
        ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
      });
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TRANSCRIBE_TIMEOUT_MS;
    this.fetchAudio = config.fetchAudio ?? defaultFetchAudio;
  }

  async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const file = await this.fetchAudio(input.audioUrl, input.contentType);
      // Cast Blob → File-shaped for the SDK; openai's `Uploadable` accepts
      // File | Response | Buffer | Blob in practice.
      const sdkFile = file as unknown as File;
      const response = (await this.client.audio.transcriptions.create(
        {
          file: sdkFile,
          model: MODEL,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
          ...(input.language !== undefined ? { language: input.language } : {}),
        },
        { signal: controller.signal },
      )) as unknown as VerboseJsonResponse;

      const segments: TranscriptionSegment[] = (response.segments ?? [])
        .map((seg): TranscriptionSegment | null => {
          const text = seg.text.trim();
          if (text.length === 0) return null;
          return {
            startMs: Math.round(seg.start * 1000),
            endMs: Math.round(seg.end * 1000),
            text,
            confidence: logprobToConfidence(seg.avg_logprob),
            // TODO(Story 2.3): diarization via Pyannote pass — populate
            // `speaker` from a separate diarization call and merge here.
            speaker: null,
          };
        })
        .filter((seg): seg is TranscriptionSegment => seg !== null);

      return {
        segments,
        detectedLanguage: response.language ?? input.language ?? 'en',
        durationMs: response.duration !== undefined ? Math.round(response.duration * 1000) : 0,
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
