/**
 * Mobile vitest runs under node — we test the pure budget wrapper that
 * carries the 10-min retry policy. Same approach as the heartbeat
 * scheduler tests: extract the side-effect-free core and exercise it
 * directly.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: vi.fn(async () => ({ exists: true, size: 0 })),
  readAsStringAsync: vi.fn(async () => ''),
}));

import type { ChunkPoster, UploadEnvelope } from '../lib/recording/chunk-uploader';
import { UploadBudgetExhaustedError, wrapPosterWithBudget } from './use-resumable-upload';

const envelope: UploadEnvelope = {
  recordingId: 'rec-1',
  uploadId: 'up-1',
  chunkIndex: 0,
  totalChunks: 1,
  mimeType: 'audio/webm',
  base64: '',
  byteLength: 0,
};

describe('wrapPosterWithBudget — Story 4.5 (mobile)', () => {
  it('passes through on success', async () => {
    const inner: ChunkPoster = vi.fn(async () => ({ chunkIndex: 0, etag: 'ok' }));
    const wrapped = wrapPosterWithBudget({
      poster: inner,
      recordingId: 'rec-1',
      retryBudgetMs: 10_000,
      sleep: async () => {},
      now: () => 0,
    });
    const out = await wrapped(envelope);
    expect(out.etag).toBe('ok');
  });

  it('retries on transient failure within budget', async () => {
    let attempts = 0;
    const inner: ChunkPoster = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('flaky');
      return { chunkIndex: 0, etag: 'ok' };
    });
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const wrapped = wrapPosterWithBudget({
      poster: inner,
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
    const inner: ChunkPoster = vi.fn(async () => {
      throw new Error('still flaky');
    });
    let now = 0;
    const sleep = vi.fn(async () => {
      // Each retry costs 60s — 11 retries blow past the 10-min budget.
      now += 60_000;
    });
    const wrapped = wrapPosterWithBudget({
      poster: inner,
      recordingId: 'rec-1',
      retryBudgetMs: 10 * 60 * 1000,
      sleep,
      now: () => now,
    });
    await expect(wrapped(envelope)).rejects.toBeInstanceOf(UploadBudgetExhaustedError);
  });

  it('caps the final sleep so total elapsed never exceeds budget', async () => {
    const inner: ChunkPoster = vi.fn(async () => {
      throw new Error('flaky');
    });
    const sleeps: number[] = [];
    let now = 0;
    const sleep = async (ms: number): Promise<void> => {
      sleeps.push(ms);
      now += ms;
    };
    const wrapped = wrapPosterWithBudget({
      poster: inner,
      recordingId: 'rec-1',
      retryBudgetMs: 3_500,
      sleep,
      now: () => now,
    });
    await expect(wrapped(envelope)).rejects.toBeInstanceOf(UploadBudgetExhaustedError);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3_500);
  });

  it('exposes the cause of the exhausted error', async () => {
    const cause = new Error('terminal-network');
    const inner: ChunkPoster = vi.fn(async () => {
      throw cause;
    });
    let now = 0;
    const sleep = async (ms: number): Promise<void> => {
      now += ms;
    };
    const wrapped = wrapPosterWithBudget({
      poster: inner,
      recordingId: 'rec-1',
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
        expect(err.recordingId).toBe('rec-1');
      }
    }
  });
});
