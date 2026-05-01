/**
 * Diarization provider — Story 2.4 (Pyannote post-pass).
 *
 * Two-pass model: Whisper-API returns word-level segments with no
 * speaker labels; a separate diarization service (Pyannote, hosted as
 * a per-region container) emits `(startMs, endMs, speaker)` regions.
 * `mergeDiarization()` fuses the two streams into final segments that
 * carry stable `spk_N` labels.
 *
 * The provider abstraction mirrors `TranscriptionProvider`:
 *   - `kind` discriminator for logging
 *   - `diarize(input)` returns regions
 *   - `MockDiarizationProvider` for tests + dev
 *   - `PyannoteHttpDiarizationProvider` calls a self-hosted HTTP
 *     endpoint over plain fetch (no Python SDK in the Node runtime)
 *
 * Faster-whisper engines that return diarized labels natively skip
 * this pass entirely — the worker checks `selectDiarizationStrategy`
 * before hitting a diarization provider.
 */

import { TranscriptionError } from './errors.js';
import type { TranscriptionEngineKind, TranscriptionSegment } from './types.js';

export type DiarizationProviderKind = 'pyannote-http' | 'mock';

export interface DiarizationRequest {
  /** Same fetchable URL as transcription — provider downloads bytes. */
  audioUrl: string;
  contentType: string;
  /** Logging context only. The selector picks the strategy upstream. */
  tenantId: string;
}

/**
 * One diarized region. Boundaries are independent of transcription
 * segment boundaries — `mergeDiarization()` computes per-segment
 * speaker by majority overlap.
 */
export interface DiarizationRegion {
  startMs: number;
  endMs: number;
  /** Stable label — `spk_0`, `spk_1`, … per Pyannote convention. */
  speaker: string;
}

export interface DiarizationResult {
  regions: DiarizationRegion[];
  /** Number of distinct speakers detected. */
  speakerCount: number;
}

export interface DiarizationProvider {
  kind: DiarizationProviderKind;
  diarize(input: DiarizationRequest): Promise<DiarizationResult>;
}

/**
 * Choose the diarization strategy for an engine kind.
 *
 *   - `whisper-api`     → 'pyannote-post-pass' (a separate provider)
 *   - `faster-whisper`  → 'engine-native' (skip the post-pass; the
 *                         engine returns labels itself)
 *
 * The mock transcription engine returns null speakers; tests opt into
 * the mock-diarization path explicitly.
 */
export const selectDiarizationStrategy = (
  engineKind: TranscriptionEngineKind,
): 'pyannote-post-pass' | 'engine-native' => {
  if (engineKind === 'faster-whisper') return 'engine-native';
  return 'pyannote-post-pass';
};

/**
 * Mock provider for tests + dev. Returns deterministic regions sized
 * to whatever audio duration the test passes in via the constructor.
 */
export class MockDiarizationProvider implements DiarizationProvider {
  public readonly kind: DiarizationProviderKind = 'mock';
  constructor(private readonly result: DiarizationResult) {}

  async diarize(_input: DiarizationRequest): Promise<DiarizationResult> {
    return this.result;
  }

  /** Convenience builder — round-robins between two speakers every 5s. */
  static alternating(durationMs: number, intervalMs = 5_000): MockDiarizationProvider {
    const regions: DiarizationRegion[] = [];
    let cursor = 0;
    let speakerIdx = 0;
    while (cursor < durationMs) {
      const end = Math.min(cursor + intervalMs, durationMs);
      regions.push({
        startMs: cursor,
        endMs: end,
        speaker: `spk_${speakerIdx}`,
      });
      cursor = end;
      speakerIdx = (speakerIdx + 1) % 2;
    }
    return new MockDiarizationProvider({ regions, speakerCount: 2 });
  }
}

export interface PyannoteHttpDiarizationProviderConfig {
  /** Self-hosted HTTPS endpoint — `POST {endpoint} { audioUrl, contentType }`. */
  endpoint: string;
  /** Optional bearer token for the diarization service. */
  apiKey?: string;
  /** Per-call timeout, ms. */
  timeoutMs?: number;
}

const DEFAULT_DIARIZATION_TIMEOUT_MS = 60_000;

/**
 * HTTP-bridge provider — calls a per-region Pyannote container that
 * exposes a tiny REST surface:
 *
 *   POST {endpoint}
 *   Content-Type: application/json
 *   Body: { "audioUrl": "https://...", "contentType": "audio/webm" }
 *   200 OK: { "regions": [{startMs,endMs,speaker}], "speakerCount": N }
 *
 * Mirrors `FasterWhisperProvider`'s shape — plain fetch, no Python SDK
 * inside the Node runtime. Audio bytes never round-trip through the
 * worker; the diarization service downloads from `audioUrl` directly.
 */
export class PyannoteHttpDiarizationProvider implements DiarizationProvider {
  public readonly kind: DiarizationProviderKind = 'pyannote-http';
  private readonly timeoutMs: number;

  constructor(private readonly config: PyannoteHttpDiarizationProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_DIARIZATION_TIMEOUT_MS;
  }

  async diarize(input: DiarizationRequest): Promise<DiarizationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audioUrl: input.audioUrl,
          contentType: input.contentType,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new TranscriptionError(
          `pyannote-http: upstream returned ${res.status}: ${await safeText(res)}`,
        );
      }
      const json = (await res.json()) as unknown;
      return narrowDiarizationResponse(json);
    } finally {
      clearTimeout(timer);
    }
  }
}

const safeText = async (res: Response): Promise<string> => {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
};

const narrowDiarizationResponse = (raw: unknown): DiarizationResult => {
  if (!raw || typeof raw !== 'object') {
    throw new TranscriptionError('pyannote-http: response is not an object');
  }
  const r = raw as { regions?: unknown; speakerCount?: unknown };
  if (!Array.isArray(r.regions)) {
    throw new TranscriptionError('pyannote-http: regions is not an array');
  }
  const regions: DiarizationRegion[] = r.regions.map((row, i) => {
    if (!row || typeof row !== 'object') {
      throw new TranscriptionError(`pyannote-http: region ${i} is not an object`);
    }
    const region = row as { startMs?: unknown; endMs?: unknown; speaker?: unknown };
    if (
      typeof region.startMs !== 'number' ||
      typeof region.endMs !== 'number' ||
      typeof region.speaker !== 'string'
    ) {
      throw new TranscriptionError(`pyannote-http: region ${i} has invalid shape`);
    }
    return {
      startMs: region.startMs,
      endMs: region.endMs,
      speaker: region.speaker,
    };
  });
  const speakerCount =
    typeof r.speakerCount === 'number'
      ? r.speakerCount
      : new Set(regions.map((g) => g.speaker)).size;
  return { regions, speakerCount };
};

/**
 * Pure function — fuses transcription segments + diarization regions
 * into segments whose `speaker` field is set by majority-overlap.
 *
 * Algorithm:
 *   For each transcription segment, compute the cumulative overlap
 *   with each region. The region with the most overlap wins.
 *
 * Edge cases:
 *   - No regions → return segments unchanged (speaker stays null).
 *   - Segment lies entirely outside every region → speaker stays null
 *     (silence buffer; Pyannote may have skipped a low-energy patch).
 *   - Tied overlap → first matched region wins (stable order).
 */
export const mergeDiarization = (
  segments: readonly TranscriptionSegment[],
  regions: readonly DiarizationRegion[],
): TranscriptionSegment[] => {
  if (regions.length === 0) {
    return segments.map((s) => ({ ...s }));
  }
  return segments.map((seg) => {
    const tally = new Map<string, number>();
    for (const region of regions) {
      const overlapStart = Math.max(seg.startMs, region.startMs);
      const overlapEnd = Math.min(seg.endMs, region.endMs);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap === 0) continue;
      tally.set(region.speaker, (tally.get(region.speaker) ?? 0) + overlap);
    }
    let best: string | null = null;
    let bestMs = 0;
    for (const [speaker, ms] of tally) {
      if (ms > bestMs) {
        best = speaker;
        bestMs = ms;
      }
    }
    return { ...seg, speaker: best };
  });
};
