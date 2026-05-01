import { describe, expect, it } from 'vitest';

import { deriveRetryBudget } from './use-retry-budget.js';

const TEN_MIN_MS = 10 * 60 * 1000;

describe('deriveRetryBudget', () => {
  it('returns "idle" when not in flight', () => {
    const r = deriveRetryBudget({ lastSuccessfulChunkAtMs: null, inFlight: false });
    expect(r.state).toBe('idle');
    expect(r.shouldEscalate).toBe(false);
  });

  it('returns "fresh" when no chunks have landed yet', () => {
    const r = deriveRetryBudget({ lastSuccessfulChunkAtMs: null, inFlight: true });
    expect(r.state).toBe('fresh');
    expect(r.secondsRemaining).toBe(600);
  });

  it('returns "fresh" when the most-recent chunk landed under 30s ago', () => {
    const now = 1_700_000_000_000;
    const r = deriveRetryBudget({
      lastSuccessfulChunkAtMs: now - 10_000,
      inFlight: true,
      now,
    });
    expect(r.state).toBe('fresh');
  });

  it('returns "retrying" when the most-recent chunk landed 30s-10min ago', () => {
    const now = 1_700_000_000_000;
    const r = deriveRetryBudget({
      lastSuccessfulChunkAtMs: now - 60_000,
      inFlight: true,
      now,
    });
    expect(r.state).toBe('retrying');
    expect(r.secondsRemaining).toBeLessThan(600);
    expect(r.shouldEscalate).toBe(false);
  });

  it('escalates after the 10-min budget elapses', () => {
    const now = 1_700_000_000_000;
    const r = deriveRetryBudget({
      lastSuccessfulChunkAtMs: now - 11 * 60 * 1000,
      inFlight: true,
      now,
    });
    expect(r.state).toBe('escalated');
    expect(r.secondsRemaining).toBe(0);
    expect(r.shouldEscalate).toBe(true);
  });

  it('honors the budgetMs override', () => {
    const now = 1_700_000_000_000;
    const r = deriveRetryBudget({
      lastSuccessfulChunkAtMs: now - 60_000,
      inFlight: true,
      now,
      budgetMs: 30_000,
    });
    // 60s > 30s → escalated.
    expect(r.state).toBe('escalated');
  });

  it('returns the full window as secondsRemaining when idle', () => {
    const r = deriveRetryBudget({ lastSuccessfulChunkAtMs: 0, inFlight: false });
    expect(r.secondsRemaining).toBe(TEN_MIN_MS / 1000);
  });
});
