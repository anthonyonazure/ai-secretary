import { describe, expect, it, vi } from 'vitest';
import { createPresignedPoster } from './presigned-poster';

const buildAuthFetchStub = (responses: Record<string, () => Response>) => {
  const calls: Array<{ url: string }> = [];
  const authFetch = vi.fn(async (input: string) => {
    calls.push({ url: input });
    for (const [pattern, factory] of Object.entries(responses)) {
      if (input.includes(pattern)) return factory();
    }
    throw new Error(`unexpected fetch ${input}`);
  });
  return { authFetch, calls };
};

describe('createPresignedPoster (mobile)', () => {
  it('initiate → part PUT → complete uses base64 → bytes for the PUT body', async () => {
    const { authFetch, calls } = buildAuthFetchStub({
      '/initiate': () =>
        new Response(
          JSON.stringify({
            recordingId: '11111111-1111-1111-1111-111111111111',
            uploadId: 'upload-abc',
            key: 'tenants/t/recordings/r.bin',
          }),
          { status: 201 },
        ),
      '/parts/1': () =>
        new Response(
          JSON.stringify({
            partNumber: 1,
            url: 'https://signed.example/part-1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
          { status: 200 },
        ),
      '/complete': () =>
        new Response(
          JSON.stringify({
            recordingId: '11111111-1111-1111-1111-111111111111',
            status: 'uploaded',
            transcribeJobId: 'mem-1',
          }),
          { status: 200 },
        ),
    });
    const rawFetch = vi.fn(
      async () => new Response('', { status: 200, headers: { ETag: '"etag-1"' } }),
    );
    const ctl = createPresignedPoster({
      apiBase: 'https://api.test',
      authFetch,
      rawFetch: rawFetch as unknown as typeof fetch,
    });
    const session = await ctl.initiate({ contentType: 'audio/m4a' });
    expect(session.recordingId).toBe('11111111-1111-1111-1111-111111111111');

    // base64 for 'hi' is 'aGk='.
    const result = await ctl.poster({
      recordingId: session.recordingId,
      uploadId: session.uploadId,
      chunkIndex: 0,
      totalChunks: 1,
      mimeType: 'audio/m4a',
      base64: 'aGk=',
      byteLength: 2,
    });
    expect(result.etag).toBe('etag-1');
    expect(rawFetch).toHaveBeenCalledTimes(1);
    const putCallInit = rawFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(putCallInit?.method).toBe('PUT');
    const body = putCallInit?.body as ArrayBuffer | undefined;
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(body as ArrayBuffer).byteLength).toBe(2);

    const final = await ctl.complete(session.recordingId, [{ partNumber: 1, etag: result.etag }]);
    expect(final.status).toBe('uploaded');
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.test/api/v1/recordings/initiate',
      'https://api.test/api/v1/recordings/11111111-1111-1111-1111-111111111111/parts/1',
      'https://api.test/api/v1/recordings/11111111-1111-1111-1111-111111111111/complete',
    ]);
  });

  it('throws on initiate failure', async () => {
    const { authFetch } = buildAuthFetchStub({
      '/initiate': () => new Response('boom', { status: 500 }),
    });
    const ctl = createPresignedPoster({ apiBase: 'https://api.test', authFetch });
    await expect(ctl.initiate({ contentType: 'audio/m4a' })).rejects.toThrow(/initiate failed/);
  });

  it('synthesises an etag when provider omits the header', async () => {
    const { authFetch } = buildAuthFetchStub({
      '/parts/1': () =>
        new Response(
          JSON.stringify({
            partNumber: 1,
            url: 'https://signed.example/part-1',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
          { status: 200 },
        ),
    });
    const rawFetch = vi.fn(async () => new Response('', { status: 200 }));
    const ctl = createPresignedPoster({
      apiBase: 'https://api.test',
      authFetch,
      rawFetch: rawFetch as unknown as typeof fetch,
    });
    const result = await ctl.poster({
      recordingId: 'rid',
      uploadId: 'uid',
      chunkIndex: 0,
      totalChunks: 1,
      mimeType: 'audio/m4a',
      base64: 'aGk=',
      byteLength: 2,
    });
    expect(result.etag).toBe('presigned-0');
  });
});
