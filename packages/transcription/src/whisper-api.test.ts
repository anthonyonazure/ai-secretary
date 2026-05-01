import { describe, expect, it, vi } from 'vitest';
import { TranscriptionProviderError, TranscriptionTimeoutError } from './errors.js';
import { WhisperApiProvider, logprobToConfidence } from './whisper-api.js';

/**
 * Build a fake OpenAI client that records the call args and returns a
 * canned `verbose_json` response. We don't import the real `openai`
 * SDK in tests — we cast through `unknown` and let TypeScript trust
 * the shape.
 */
const buildFakeClient = (response: unknown, opts: { delayMs?: number } = {}) => {
  const create = vi.fn(async (_args: unknown, _opts: { signal?: AbortSignal }) => {
    if (opts.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, opts.delayMs);
        _opts.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    return response;
  });
  return {
    client: { audio: { transcriptions: { create } } } as unknown as ConstructorParameters<
      typeof WhisperApiProvider
    >[0]['client'],
    create,
  };
};

describe('logprobToConfidence', () => {
  it('maps 0 → ~1.0', () => {
    expect(logprobToConfidence(0)).toBeCloseTo(1.0, 2);
  });

  it('maps -2 → ~0.8', () => {
    expect(logprobToConfidence(-2)).toBeCloseTo(0.8, 2);
  });

  it('maps -10 → 0', () => {
    expect(logprobToConfidence(-10)).toBe(0);
  });

  it('clamps very negative values to 0', () => {
    expect(logprobToConfidence(-50)).toBe(0);
  });

  it('clamps positive values to 1', () => {
    expect(logprobToConfidence(0.5)).toBe(1);
  });

  it('returns 0 for undefined', () => {
    expect(logprobToConfidence(undefined)).toBe(0);
  });
});

describe('WhisperApiProvider', () => {
  it('maps verbose_json segments → TranscriptionSegment with speaker:null', async () => {
    const { client, create } = buildFakeClient({
      duration: 12.5,
      language: 'en',
      segments: [
        { start: 0, end: 5, text: ' Hello world', avg_logprob: -0.5 },
        { start: 5, end: 12.5, text: 'this is a test.', avg_logprob: -2.0 },
      ],
    });
    const provider = new WhisperApiProvider({
      apiKey: 'sk-test',
      client,
      fetchAudio: async () => new File(['x'], 'a.webm', { type: 'audio/webm' }),
    });
    const result = await provider.transcribe({
      audioUrl: 'https://example.com/audio.webm',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.detectedLanguage).toBe('en');
    expect(result.durationMs).toBe(12500);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({
      startMs: 0,
      endMs: 5000,
      text: 'Hello world',
      speaker: null,
    });
    expect(result.segments[0]?.confidence).toBeCloseTo(0.95, 2);
    expect(result.segments[1]).toMatchObject({
      startMs: 5000,
      endMs: 12500,
      text: 'this is a test.',
      speaker: null,
    });
    expect(result.segments[1]?.confidence).toBeCloseTo(0.8, 2);
  });

  it('drops empty segments after trimming', async () => {
    const { client } = buildFakeClient({
      duration: 5,
      language: 'en',
      segments: [
        { start: 0, end: 2, text: '   ', avg_logprob: -0.1 },
        { start: 2, end: 5, text: 'real text', avg_logprob: -0.1 },
      ],
    });
    const provider = new WhisperApiProvider({
      apiKey: 'sk-test',
      client,
      fetchAudio: async () => new File(['x'], 'a.webm', { type: 'audio/webm' }),
    });
    const result = await provider.transcribe({
      audioUrl: 'https://example.com/audio.webm',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe('real text');
  });

  it('falls back to language hint when API omits language', async () => {
    const { client } = buildFakeClient({
      duration: 3,
      segments: [{ start: 0, end: 3, text: 'hola', avg_logprob: 0 }],
    });
    const provider = new WhisperApiProvider({
      apiKey: 'sk-test',
      client,
      fetchAudio: async () => new File(['x'], 'a.webm', { type: 'audio/webm' }),
    });
    const result = await provider.transcribe({
      audioUrl: 'https://example.com/audio.webm',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
      language: 'es',
    });
    expect(result.detectedLanguage).toBe('es');
  });

  it('wraps SDK errors in TranscriptionProviderError', async () => {
    const { client } = {
      client: {
        audio: {
          transcriptions: {
            create: vi.fn(async () => {
              throw new Error('429 rate limited');
            }),
          },
        },
      } as unknown as ConstructorParameters<typeof WhisperApiProvider>[0]['client'],
    };
    const provider = new WhisperApiProvider({
      apiKey: 'sk-test',
      client,
      fetchAudio: async () => new File(['x'], 'a.webm', { type: 'audio/webm' }),
    });
    await expect(
      provider.transcribe({
        audioUrl: 'https://example.com/audio.webm',
        contentType: 'audio/webm',
        tenantId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(TranscriptionProviderError);
  });

  it('throws TranscriptionTimeoutError when the request runs past the timeout', async () => {
    const { client } = buildFakeClient(
      { duration: 1, language: 'en', segments: [] },
      { delayMs: 200 },
    );
    const provider = new WhisperApiProvider({
      apiKey: 'sk-test',
      client,
      timeoutMs: 25,
      fetchAudio: async () => new File(['x'], 'a.webm', { type: 'audio/webm' }),
    });
    await expect(
      provider.transcribe({
        audioUrl: 'https://example.com/audio.webm',
        contentType: 'audio/webm',
        tenantId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(TranscriptionTimeoutError);
  });
});
