import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MockDiarizationProvider,
  PyannoteHttpDiarizationProvider,
  mergeDiarization,
  selectDiarizationStrategy,
} from './diarization.js';
import { TranscriptionError } from './errors.js';
import type { TranscriptionSegment } from './types.js';

const seg = (startMs: number, endMs: number, text = 'hello'): TranscriptionSegment => ({
  startMs,
  endMs,
  text,
  confidence: 0.9,
  speaker: null,
});

describe('selectDiarizationStrategy', () => {
  it('whisper-api needs the post-pass', () => {
    expect(selectDiarizationStrategy('whisper-api')).toBe('pyannote-post-pass');
  });

  it('faster-whisper handles diarization natively', () => {
    expect(selectDiarizationStrategy('faster-whisper')).toBe('engine-native');
  });
});

describe('mergeDiarization', () => {
  it('returns segments unchanged when no regions are supplied', () => {
    const result = mergeDiarization([seg(0, 1000)], []);
    expect(result[0]?.speaker).toBeNull();
  });

  it('attaches the majority-overlap speaker', () => {
    const segments = [seg(0, 1000, 'A'), seg(1000, 2000, 'B'), seg(2000, 3000, 'C')];
    const regions = [
      { startMs: 0, endMs: 1500, speaker: 'spk_0' },
      { startMs: 1500, endMs: 3000, speaker: 'spk_1' },
    ];
    const result = mergeDiarization(segments, regions);
    expect(result.map((s) => s.speaker)).toEqual(['spk_0', 'spk_0', 'spk_1']);
  });

  it('keeps speaker null when a segment lies in a silence gap', () => {
    const segments = [seg(0, 500), seg(500, 800), seg(800, 1500)];
    const regions = [
      { startMs: 0, endMs: 400, speaker: 'spk_0' },
      { startMs: 1000, endMs: 1500, speaker: 'spk_1' },
    ];
    const result = mergeDiarization(segments, regions);
    expect(result.map((s) => s.speaker)).toEqual(['spk_0', null, 'spk_1']);
  });

  it('breaks ties by region order (first-matched wins)', () => {
    const segments = [seg(0, 1000)];
    // Two regions with exactly equal overlap.
    const regions = [
      { startMs: 0, endMs: 500, speaker: 'spk_0' },
      { startMs: 500, endMs: 1000, speaker: 'spk_1' },
    ];
    const result = mergeDiarization(segments, regions);
    // First region accumulates first; tally update preserves it.
    expect(result[0]?.speaker).toBe('spk_0');
  });

  it('does not mutate the input segments', () => {
    const original = [seg(0, 1000)];
    const cloned = JSON.parse(JSON.stringify(original));
    mergeDiarization(original, [{ startMs: 0, endMs: 1000, speaker: 'spk_0' }]);
    expect(original).toEqual(cloned);
  });
});

describe('MockDiarizationProvider', () => {
  it('returns the canned result', async () => {
    const provider = new MockDiarizationProvider({
      regions: [{ startMs: 0, endMs: 500, speaker: 'spk_0' }],
      speakerCount: 1,
    });
    const result = await provider.diarize({
      audioUrl: 'https://test/audio',
      contentType: 'audio/wav',
      tenantId: 't1',
    });
    expect(result.speakerCount).toBe(1);
    expect(result.regions[0]?.speaker).toBe('spk_0');
  });

  it('alternating() round-robins between two speakers', async () => {
    const provider = MockDiarizationProvider.alternating(12_000, 5_000);
    const result = await provider.diarize({
      audioUrl: 'https://test',
      contentType: 'audio/wav',
      tenantId: 't1',
    });
    expect(result.regions).toHaveLength(3);
    expect(result.regions.map((r) => r.speaker)).toEqual(['spk_0', 'spk_1', 'spk_0']);
    expect(result.regions[2]?.startMs).toBe(10_000);
    expect(result.regions[2]?.endMs).toBe(12_000);
  });
});

describe('PyannoteHttpDiarizationProvider', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('POSTs to the endpoint and parses regions', async () => {
    const fetchSpy = vi.fn(async (url, init) => {
      expect(url).toBe('https://pyannote.test/diarize');
      expect((init as RequestInit).method).toBe('POST');
      return new Response(
        JSON.stringify({
          regions: [
            { startMs: 0, endMs: 500, speaker: 'spk_0' },
            { startMs: 500, endMs: 1200, speaker: 'spk_1' },
          ],
          speakerCount: 2,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new PyannoteHttpDiarizationProvider({
      endpoint: 'https://pyannote.test/diarize',
      apiKey: 'test-key',
    });
    const result = await provider.diarize({
      audioUrl: 'https://audio.example/recording.wav',
      contentType: 'audio/wav',
      tenantId: 't1',
    });
    expect(result.speakerCount).toBe(2);
    expect(result.regions).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('throws a TranscriptionError on a non-2xx response', async () => {
    globalThis.fetch = (async () =>
      new Response('upstream sad', { status: 500 })) as unknown as typeof fetch;
    const provider = new PyannoteHttpDiarizationProvider({
      endpoint: 'https://pyannote.test/diarize',
    });
    await expect(
      provider.diarize({
        audioUrl: 'https://audio.example/recording.wav',
        contentType: 'audio/wav',
        tenantId: 't1',
      }),
    ).rejects.toBeInstanceOf(TranscriptionError);
  });

  it('throws a TranscriptionError on a malformed response', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ regions: 'not-an-array' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    const provider = new PyannoteHttpDiarizationProvider({
      endpoint: 'https://pyannote.test/diarize',
    });
    await expect(
      provider.diarize({
        audioUrl: 'https://audio.example/recording.wav',
        contentType: 'audio/wav',
        tenantId: 't1',
      }),
    ).rejects.toBeInstanceOf(TranscriptionError);
  });
});
