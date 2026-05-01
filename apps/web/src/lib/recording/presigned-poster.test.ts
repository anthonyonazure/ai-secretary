import { describe, expect, it, vi } from 'vitest';
import { createPresignedPoster } from './presigned-poster';

const HAS_BLOB = typeof Blob !== 'undefined';

const buildAuthFetchStub = (
  responses: Record<string, () => Response>,
): { authFetch: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const authFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    calls.push({ url: urlStr, ...(init !== undefined ? { init } : {}) });
    for (const [pattern, factory] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) return factory();
    }
    throw new Error(`unexpected fetch ${urlStr}`);
  });
  return { authFetch: authFetch as unknown as typeof fetch, calls };
};

describe.skipIf(!HAS_BLOB)('createPresignedPoster (web)', () => {
  it('initiate → part PUT → complete flows end to end', async () => {
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
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('', { status: 200, headers: { ETag: '"etag-1"' } }),
    );

    const ctl = createPresignedPoster({
      apiBase: 'https://api.test',
      authFetch,
      rawFetch: rawFetch as unknown as typeof fetch,
    });

    const session = await ctl.initiate({ contentType: 'audio/webm' });
    expect(session.recordingId).toBe('11111111-1111-1111-1111-111111111111');
    expect(session.uploadId).toBe('upload-abc');

    const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
    const result = await ctl.poster({
      recordingId: session.recordingId,
      uploadId: session.uploadId,
      chunkIndex: 0,
      totalChunks: 1,
      mimeType: 'audio/webm',
      blob,
    });
    expect(result.etag).toBe('etag-1');
    // Verify presigned PUT used raw fetch (not auth-fetch).
    expect(rawFetch).toHaveBeenCalledTimes(1);
    expect(rawFetch.mock.calls[0]?.[0]).toBe('https://signed.example/part-1');

    const final = await ctl.complete(session.recordingId, [{ partNumber: 1, etag: result.etag }]);
    expect(final.status).toBe('uploaded');
    expect(final.transcribeJobId).toBe('mem-1');

    // calls: initiate, part-presign, complete (PUT goes to rawFetch).
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.test/api/v1/recordings/initiate',
      'https://api.test/api/v1/recordings/11111111-1111-1111-1111-111111111111/parts/1',
      'https://api.test/api/v1/recordings/11111111-1111-1111-1111-111111111111/complete',
    ]);
  });

  it('throws when initiate fails', async () => {
    const { authFetch } = buildAuthFetchStub({
      '/initiate': () => new Response('boom', { status: 500 }),
    });
    const ctl = createPresignedPoster({ apiBase: 'https://api.test', authFetch });
    await expect(ctl.initiate({ contentType: 'audio/webm' })).rejects.toThrow(/initiate failed/);
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
    const blob = new Blob([new Uint8Array(10)], { type: 'audio/webm' });
    const result = await ctl.poster({
      recordingId: 'rid',
      uploadId: 'uid',
      chunkIndex: 0,
      totalChunks: 1,
      mimeType: 'audio/webm',
      blob,
    });
    expect(result.etag).toBe('presigned-0');
  });
});
