import { describe, expect, it, vi } from 'vitest';
import { TranscriptionProviderError, TranscriptionTimeoutError } from './errors.js';
import { FasterWhisperProvider } from './faster-whisper.js';

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('FasterWhisperProvider', () => {
  it('POSTs JSON with audioUrl + contentType + language and maps the response', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      okJson({
        segments: [
          { startMs: 0, endMs: 5000, text: 'Hello world', confidence: 0.95 },
          { startMs: 5000, endMs: 10000, text: '   ', confidence: 0.9 },
          { startMs: 10000, endMs: 15000, text: 'and another', confidence: 0.88 },
        ],
        detectedLanguage: 'en',
        durationMs: 15000,
      }),
    );
    const provider = new FasterWhisperProvider({
      endpoint: 'http://faster-whisper.local:8000/',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.transcribe({
      audioUrl: 'https://example.com/a.webm',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
      language: 'en',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('http://faster-whisper.local:8000/transcribe');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      audioUrl: 'https://example.com/a.webm',
      contentType: 'audio/webm',
      language: 'en',
    });
    // Empty-text segment dropped, others preserved.
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({
      startMs: 0,
      endMs: 5000,
      text: 'Hello world',
      confidence: 0.95,
      speaker: null,
    });
    expect(result.detectedLanguage).toBe('en');
    expect(result.durationMs).toBe(15000);
  });

  it('attaches a Bearer auth header when authToken is configured', async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ segments: [], detectedLanguage: 'en', durationMs: 0 }),
    );
    const provider = new FasterWhisperProvider({
      endpoint: 'http://fw.local:8000',
      authToken: 'shhh',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await provider.transcribe({
      audioUrl: 'https://example.com/a.webm',
      contentType: 'audio/webm',
      tenantId: '00000000-0000-0000-0000-000000000000',
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer shhh');
  });

  it('wraps non-200 responses in TranscriptionProviderError', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 503 }));
    const provider = new FasterWhisperProvider({
      endpoint: 'http://fw.local:8000',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(
      provider.transcribe({
        audioUrl: 'https://example.com/a.webm',
        contentType: 'audio/webm',
        tenantId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(TranscriptionProviderError);
  });

  it('rejects malformed payloads with TranscriptionProviderError', async () => {
    const fetchMock = vi.fn(async () => okJson({ unexpected: 'shape' }));
    const provider = new FasterWhisperProvider({
      endpoint: 'http://fw.local:8000',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(
      provider.transcribe({
        audioUrl: 'https://example.com/a.webm',
        contentType: 'audio/webm',
        tenantId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(TranscriptionProviderError);
  });

  it('throws TranscriptionTimeoutError when fetch outruns timeoutMs', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
      return okJson({ segments: [], detectedLanguage: 'en', durationMs: 0 });
    });
    const provider = new FasterWhisperProvider({
      endpoint: 'http://fw.local:8000',
      fetch: fetchMock as unknown as typeof fetch,
      timeoutMs: 25,
    });
    await expect(
      provider.transcribe({
        audioUrl: 'https://example.com/a.webm',
        contentType: 'audio/webm',
        tenantId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toBeInstanceOf(TranscriptionTimeoutError);
  });

  it('throws if endpoint is empty', () => {
    expect(
      () =>
        new FasterWhisperProvider({
          endpoint: '',
        }),
    ).toThrow(/endpoint is required/);
  });
});
