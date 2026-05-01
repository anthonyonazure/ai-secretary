import { describe, expect, it, vi } from 'vitest';
import {
  type ChunkPoster,
  type RetryPolicy,
  planChunks,
  uploadBlobInChunks,
} from './chunk-uploader';

const HAS_BLOB = typeof Blob !== 'undefined';

describe('planChunks', () => {
  it('returns empty for zero size', () => {
    expect(planChunks(0)).toEqual([]);
  });

  it('produces N ranges that exactly cover the input', () => {
    const ranges = planChunks(2_500_000, 1_000_000);
    expect(ranges.length).toBe(3);
    expect(ranges[0]).toEqual({ index: 0, start: 0, end: 1_000_000 });
    expect(ranges[1]).toEqual({ index: 1, start: 1_000_000, end: 2_000_000 });
    expect(ranges[2]).toEqual({ index: 2, start: 2_000_000, end: 2_500_000 });
  });

  it('handles exact multiples', () => {
    const ranges = planChunks(2_000_000, 1_000_000);
    expect(ranges.length).toBe(2);
    expect(ranges[1]).toEqual({ index: 1, start: 1_000_000, end: 2_000_000 });
  });
});

describe.skipIf(!HAS_BLOB)('uploadBlobInChunks', () => {
  it('posts each chunk in order and reports monotonic progress', async () => {
    const blob = new Blob([new Uint8Array(2_500_000)], { type: 'audio/webm' });
    const calls: number[] = [];
    const poster: ChunkPoster = vi.fn(async (envelope) => {
      calls.push(envelope.chunkIndex);
      return { chunkIndex: envelope.chunkIndex, etag: `etag-${envelope.chunkIndex}` };
    });
    const progress: number[] = [];
    const results = await uploadBlobInChunks({
      recordingId: 'r1',
      uploadId: 'u1',
      blob,
      mimeType: 'audio/webm',
      chunkSize: 1_000_000,
      poster,
      onProgress: (frac) => progress.push(frac),
    });
    expect(results.length).toBe(3);
    expect(calls).toEqual([0, 1, 2]);
    expect(progress).toEqual([1 / 3, 2 / 3, 3 / 3]);
  });

  it('retries failing chunks per the policy and ultimately succeeds', async () => {
    const blob = new Blob([new Uint8Array(1_000_000)], { type: 'audio/webm' });
    let attempts = 0;
    const poster: ChunkPoster = vi.fn(async (envelope) => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient');
      return { chunkIndex: envelope.chunkIndex, etag: 'etag-final' };
    });
    const policy: RetryPolicy = {
      maxAttempts: 3,
      backoffMs: () => 0,
      sleep: () => Promise.resolve(),
    };
    const results = await uploadBlobInChunks({
      recordingId: 'r1',
      uploadId: 'u1',
      blob,
      mimeType: 'audio/webm',
      chunkSize: 1_000_000,
      poster,
      retry: policy,
    });
    expect(results.length).toBe(1);
    expect(attempts).toBe(3);
  });

  it('rejects when all retry attempts fail', async () => {
    const blob = new Blob([new Uint8Array(1_000_000)], { type: 'audio/webm' });
    const poster: ChunkPoster = vi.fn(async () => {
      throw new Error('hard fail');
    });
    const policy: RetryPolicy = {
      maxAttempts: 2,
      backoffMs: () => 0,
      sleep: () => Promise.resolve(),
    };
    await expect(
      uploadBlobInChunks({
        recordingId: 'r1',
        uploadId: 'u1',
        blob,
        mimeType: 'audio/webm',
        chunkSize: 1_000_000,
        poster,
        retry: policy,
      }),
    ).rejects.toThrow('hard fail');
  });

  it('aborts early when the signal is already aborted', async () => {
    const blob = new Blob([new Uint8Array(1_000)], { type: 'audio/webm' });
    const poster: ChunkPoster = vi.fn(async (envelope) => ({
      chunkIndex: envelope.chunkIndex,
      etag: 'never',
    }));
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadBlobInChunks({
        recordingId: 'r1',
        uploadId: 'u1',
        blob,
        mimeType: 'audio/webm',
        poster,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/abort/i);
    expect(poster).not.toHaveBeenCalled();
  });
});
