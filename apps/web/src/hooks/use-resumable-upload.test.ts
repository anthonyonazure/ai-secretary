/**
 * Story 4.5 tests — verify the 10-min retry budget enforcement.
 *
 * The budget logic lives in the pure `wrapPosterWithBudget` helper.
 * Vitest under node can drive it directly without React; the hook
 * itself is a thin wrapper that delegates to this function. The
 * mobile mirror takes the same approach.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ChunkPoster, UploadEnvelope } from '../lib/recording/chunk-uploader';
import {
  RETRY_BUDGET_MS,
  UploadBudgetExhaustedError,
  wrapPosterWithBudget,
} from './use-resumable-upload';

const buildBlob = (bytes = 1024): Blob => new Blob([new Uint8Array(bytes)], { type: 'audio/webm' });

const envelope: UploadEnvelope = {
  recordingId: 'rec-1',
  uploadId: 'up-1',
  chunkIndex: 0,
  totalChunks: 1,
  mimeType: 'audio/webm',
  blob: buildBlob(),
};

describe('wrapPosterWithBudget — Story 4.5 (web)', () => {
  it('passes through on success', async () => {
    const poster: ChunkPoster = vi.fn(async (env) => ({
      chunkIndex: env.chunkIndex,
      etag: 'ok',
    }));
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-1',
      retryBudgetMs: 10_000,
      sleep: async () => {},
      now: () => 0,
    });
    const out = await wrapped(envelope);
    expect(out.etag).toBe('ok');
    expect(poster).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure within budget', async () => {
    let attempts = 0;
    const poster: ChunkPoster = vi.fn(async (env) => {
      attempts += 1;
      if (attempts < 3) throw new Error('flaky');
      return { chunkIndex: env.chunkIndex, etag: 'ok' };
    });
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-1',
      retryBudgetMs: 60_000,
      sleep,
      now: () => now,
    });
    const out = await wrapped(envelope);
    expect(out.etag).toBe('ok');
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws UploadBudgetExhaustedError when budget elapses', async () => {
    const poster: ChunkPoster = vi.fn(async () => {
      throw new Error('still flaky');
    });
    let now = 0;
    const sleep = vi.fn(async () => {
      now += 60_000;
    });
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-1',
      retryBudgetMs: 10 * 60 * 1000,
      sleep,
      now: () => now,
    });
    await expect(wrapped(envelope)).rejects.toBeInstanceOf(UploadBudgetExhaustedError);
  });

  it('honors a custom retryBudgetMs', async () => {
    const posterFn = vi.fn(async () => {
      throw new Error('flaky');
    });
    const poster: ChunkPoster = posterFn;
    let now = 0;
    const sleep = vi.fn(async () => {
      now += 2_000;
    });
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-2',
      retryBudgetMs: 5_000,
      sleep,
      now: () => now,
    });
    await expect(wrapped(envelope)).rejects.toBeInstanceOf(UploadBudgetExhaustedError);
    // With a 5s budget and 2s per sleep, the wrapper attempts 4 times
    // before elapsed >= budget. (Default 10-min budget would yield far
    // more — this asserts the budget short-circuits as expected.)
    expect(posterFn.mock.calls.length).toBeLessThan(10);
    expect(posterFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('caps backoff sleep so we never overshoot the budget', async () => {
    const poster: ChunkPoster = vi.fn(async () => {
      throw new Error('flaky');
    });
    const sleeps: number[] = [];
    let now = 0;
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms);
      now += ms;
    };
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-3',
      retryBudgetMs: 3_500,
      sleep,
      now: () => now,
    });
    await expect(wrapped(envelope)).rejects.toBeInstanceOf(UploadBudgetExhaustedError);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3_500);
  });

  it('exposes the cause on the exhausted error', async () => {
    const cause = new Error('terminal-network');
    const poster: ChunkPoster = vi.fn(async () => {
      throw cause;
    });
    let now = 0;
    const sleep = async (ms: number): Promise<void> => {
      now += ms;
    };
    const wrapped = wrapPosterWithBudget({
      poster,
      recordingId: 'rec-4',
      retryBudgetMs: 1_000,
      sleep,
      now: () => now,
    });
    try {
      await wrapped(envelope);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadBudgetExhaustedError);
      if (err instanceof UploadBudgetExhaustedError) {
        expect(err.cause).toBe(cause);
        expect(err.recordingId).toBe('rec-4');
      }
    }
  });

  it('exports the documented budget constant', () => {
    expect(RETRY_BUDGET_MS).toBe(10 * 60 * 1000);
  });
});
