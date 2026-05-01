import type {
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TranscriptionSegment,
} from './types.js';

/**
 * Deterministic transcription provider for tests + dev environments.
 *
 * Worker integration tests inject this so they don't talk to the real
 * Whisper API or a self-hosted service. Dev environments fall back
 * to this when no `OPENAI_API_KEY` / `FASTER_WHISPER_URL` is set —
 * the worker logs a warning and uses the mock so the rest of the
 * pipeline (status FSM, speaker_turns insertion, downstream queues)
 * can still be exercised end-to-end.
 *
 * The mock is intentionally tiny — no fixture loading, no clock
 * mocking, no async delay. Tests that want to simulate latency or
 * provider errors should construct their own `TranscriptionProvider`
 * with a `vi.fn()` `transcribe` impl.
 */

export interface MockTranscriptionProviderOptions {
  segments: TranscriptionSegment[];
  detectedLanguage?: string;
  durationMs?: number;
}

export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly kind = 'mock' as const;
  private readonly result: TranscriptionResult;
  /** Last request seen — useful in tests to assert routing. */
  lastRequest: TranscriptionRequest | null = null;

  constructor(options: MockTranscriptionProviderOptions) {
    const durationMs =
      options.durationMs ?? options.segments.reduce((max, s) => Math.max(max, s.endMs), 0);
    this.result = {
      segments: options.segments,
      detectedLanguage: options.detectedLanguage ?? 'en',
      durationMs,
    };
  }

  async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
    this.lastRequest = input;
    return this.result;
  }

  /**
   * Build a mock from a single text string by chunking into roughly
   * `chunkMs` pieces aligned to word boundaries. The default
   * 5-second chunk is what Whisper-API typically returns for natural
   * speech and is what the worker handler integration test asserts
   * against.
   */
  static fromText(
    text: string,
    durationMs: number,
    options: { chunkMs?: number; detectedLanguage?: string } = {},
  ): MockTranscriptionProvider {
    const chunkMs = options.chunkMs ?? 5_000;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return new MockTranscriptionProvider({
        segments: [],
        detectedLanguage: options.detectedLanguage ?? 'en',
        durationMs,
      });
    }
    const totalSegments = Math.max(1, Math.ceil(durationMs / chunkMs));
    const words = trimmed.split(/\s+/);
    const wordsPerSegment = Math.max(1, Math.ceil(words.length / totalSegments));
    const segments: TranscriptionSegment[] = [];
    for (let i = 0; i < totalSegments; i += 1) {
      const start = Math.min(durationMs, i * chunkMs);
      const end = Math.min(durationMs, start + chunkMs);
      if (end <= start) break;
      const chunkWords = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment);
      if (chunkWords.length === 0) break;
      segments.push({
        startMs: start,
        endMs: end,
        text: chunkWords.join(' '),
        confidence: 0.9,
        speaker: null,
      });
    }
    return new MockTranscriptionProvider({
      segments,
      detectedLanguage: options.detectedLanguage ?? 'en',
      durationMs,
    });
  }
}
