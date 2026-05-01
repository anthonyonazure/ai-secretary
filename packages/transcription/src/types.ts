/**
 * Public contract for the transcription provider abstraction.
 *
 * Story 2.2 ships:
 *   - `WhisperApiProvider`   — OpenAI Whisper API (ZDR; non-regulated tenants)
 *   - `FasterWhisperProvider` — self-hosted faster-whisper HTTP endpoint
 *                              (HIPAA / EU / BYOK tenants — audio never
 *                               leaves the tenant's data plane)
 *   - `MockTranscriptionProvider` — deterministic; tests + dev
 *
 * Per-tenant routing lives in `selector.ts`; the worker handler
 * (`apps/workers/src/handlers/transcribe.ts`) calls the selector first,
 * then asks the factory for a concrete provider.
 *
 * Diarization (Story 2.4) — `TranscriptionSegment.speaker` is
 * `string | null`. Whisper-API engine produces null labels; the
 * separate `DiarizationProvider` (also exported from this package) emits
 * `(startMs, endMs, speakerLabel)` regions, and `mergeDiarization()`
 * fuses the two streams into segments that carry stable `spk_N` labels
 * (or external user IDs when the bot has matched a speaker). Faster-
 * whisper may return labels natively; the contract is the same.
 */

export type TranscriptionEngineKind = 'whisper-api' | 'faster-whisper';

/** Discriminator used by the factory + worker logging. */
export type TranscriptionProviderKind = TranscriptionEngineKind | 'mock';

export interface TranscriptionRequest {
  /**
   * Presigned-GET URL or otherwise publicly-fetchable audio URL.
   * - WhisperApiProvider downloads the bytes then forwards a multipart
   *   upload to the API (Whisper API does not accept URLs directly).
   * - FasterWhisperProvider passes the URL straight through to its
   *   HTTP endpoint; the self-hosted service fetches the audio itself
   *   (no round-trip through the worker process).
   */
  audioUrl: string;
  /** MIME type of the audio (e.g. 'audio/webm', 'audio/mp4'). */
  contentType: string;
  /** Optional ISO 639-1 language hint. */
  language?: string;
  /**
   * Tenant id — drives logging context only. The selector has already
   * picked the engine; the provider should NOT branch on tenantId.
   */
  tenantId: string;
}

export interface TranscriptionSegment {
  /** Start of the span in milliseconds from the start of the audio. */
  startMs: number;
  /** End of the span in milliseconds from the start of the audio. */
  endMs: number;
  /** Transcribed text for this segment. Trimmed; never empty. */
  text: string;
  /**
   * Model confidence in the range [0, 1]. Higher = more confident.
   *
   * Whisper API exposes per-segment `avg_logprob` (range roughly
   * [-1, 0] for clean audio); we map via the heuristic in
   * `whisper-api.ts` to a 0..1 confidence. Faster-whisper services are
   * expected to return confidence directly.
   */
  confidence: number;
  /**
   * Diarized speaker label or null. Whisper-API segments arrive with
   * null; `mergeDiarization()` populates the field after a Pyannote
   * post-pass. Faster-whisper may return non-null directly.
   *
   * Stable shape: `spk_N` (Pyannote default) or an opaque external user
   * id once a meeting bot has matched the diarized speaker to a
   * participant. Citation deep-link contract uses `(meetingId, turnId)`,
   * NOT the speaker label, so the label is allowed to evolve over time
   * without breaking citation links.
   */
  speaker: string | null;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  /** ISO 639-1 detected language code. */
  detectedLanguage: string;
  /** Total audio duration in milliseconds. */
  durationMs: number;
}

export interface TranscriptionProvider {
  /** Discriminator — useful for logging + tests. */
  kind: TranscriptionProviderKind;
  transcribe(input: TranscriptionRequest): Promise<TranscriptionResult>;
}

/**
 * Default per-call timeout. Both real providers respect this via
 * AbortSignal; the mock ignores it. 30 seconds is generous for a
 * 30-minute audio file at a typical Whisper-API throughput; longer
 * audio jobs are split upstream by `apps/workers` in a future story.
 */
export const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 30_000;
