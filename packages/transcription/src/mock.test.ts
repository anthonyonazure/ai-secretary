import { describe, expect, it } from 'vitest';
import { MockTranscriptionProvider } from './mock.js';

describe('MockTranscriptionProvider', () => {
  it('returns the canned segments verbatim', async () => {
    const provider = new MockTranscriptionProvider({
      segments: [
        { startMs: 0, endMs: 1000, text: 'a', confidence: 1, speaker: null },
        { startMs: 1000, endMs: 2000, text: 'b', confidence: 1, speaker: null },
      ],
      detectedLanguage: 'fr',
      durationMs: 2000,
    });
    const result = await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.segments).toHaveLength(2);
    expect(result.detectedLanguage).toBe('fr');
    expect(result.durationMs).toBe(2000);
  });

  it('records the last request seen', async () => {
    const provider = new MockTranscriptionProvider({ segments: [] });
    await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: 'tenant-x',
    });
    expect(provider.lastRequest?.tenantId).toBe('tenant-x');
  });

  it('fromText splits a single sentence into 5-second chunks by default', async () => {
    const provider = MockTranscriptionProvider.fromText(
      'one two three four five six seven eight nine ten eleven twelve',
      30_000,
    );
    const result = await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    // 30s / 5s = 6 chunks (12 words / 2 per chunk).
    expect(result.segments).toHaveLength(6);
    expect(result.segments[0]?.startMs).toBe(0);
    expect(result.segments[0]?.endMs).toBe(5000);
    expect(result.segments[5]?.endMs).toBe(30_000);
    expect(result.segments.every((s) => s.speaker === null)).toBe(true);
    // Every segment should hold at least one word.
    expect(result.segments.every((s) => s.text.length > 0)).toBe(true);
  });

  it('fromText returns a single segment when text fits in chunkMs', async () => {
    const provider = MockTranscriptionProvider.fromText('Hello world', 4_000);
    const result = await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe('Hello world');
    expect(result.segments[0]?.startMs).toBe(0);
    expect(result.segments[0]?.endMs).toBe(4_000);
  });

  it('fromText handles empty text', async () => {
    const provider = MockTranscriptionProvider.fromText('   ', 5_000);
    const result = await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.segments).toHaveLength(0);
    expect(result.durationMs).toBe(5_000);
  });

  it('fromText respects a custom chunkMs', async () => {
    const provider = MockTranscriptionProvider.fromText('a b c d e f g h', 8_000, {
      chunkMs: 2_000,
    });
    const result = await provider.transcribe({
      audioUrl: 'mock://audio',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.segments).toHaveLength(4);
    expect(result.segments[3]?.endMs).toBe(8_000);
  });
});
