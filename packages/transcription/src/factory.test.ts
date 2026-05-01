import { describe, expect, it } from 'vitest';
import { TranscriptionProviderError } from './errors.js';
import { createTranscriptionProvider } from './factory.js';
import { FasterWhisperProvider } from './faster-whisper.js';
import { WhisperApiProvider } from './whisper-api.js';

describe('createTranscriptionProvider', () => {
  it('builds a WhisperApiProvider when kind=whisper-api with apiKey', () => {
    const provider = createTranscriptionProvider({
      kind: 'whisper-api',
      whisperApi: { apiKey: 'sk-test' },
    });
    expect(provider).toBeInstanceOf(WhisperApiProvider);
    expect(provider.kind).toBe('whisper-api');
  });

  it('builds a FasterWhisperProvider when kind=faster-whisper with endpoint', () => {
    const provider = createTranscriptionProvider({
      kind: 'faster-whisper',
      fasterWhisper: { endpoint: 'http://fw.local:8000' },
    });
    expect(provider).toBeInstanceOf(FasterWhisperProvider);
    expect(provider.kind).toBe('faster-whisper');
  });

  it('throws if kind=whisper-api but apiKey is missing', () => {
    expect(() =>
      createTranscriptionProvider({
        kind: 'whisper-api',
      }),
    ).toThrow(TranscriptionProviderError);
  });

  it('throws if kind=faster-whisper but endpoint is missing', () => {
    expect(() =>
      createTranscriptionProvider({
        kind: 'faster-whisper',
      }),
    ).toThrow(TranscriptionProviderError);
  });

  it('throws if kind=whisper-api with empty apiKey string', () => {
    expect(() =>
      createTranscriptionProvider({
        kind: 'whisper-api',
        whisperApi: { apiKey: '' },
      }),
    ).toThrow(TranscriptionProviderError);
  });
});
