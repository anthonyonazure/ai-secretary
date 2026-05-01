import { describe, expect, it } from 'vitest';

import { deriveSearchState } from './use-search-state.js';

describe('deriveSearchState', () => {
  it('returns "idle" when the query is too short', () => {
    const r = deriveSearchState({ query: 'a', isFetching: false, results: [], error: null });
    expect(r.kind).toBe('idle');
    expect(r.showSpinner).toBe(false);
  });

  it('treats whitespace-only queries as idle', () => {
    const r = deriveSearchState({ query: '   ', isFetching: false, results: [], error: null });
    expect(r.kind).toBe('idle');
  });

  it('returns "pending" with spinner while fetching', () => {
    const r = deriveSearchState({ query: 'meeting', isFetching: true, results: [], error: null });
    expect(r.kind).toBe('pending');
    expect(r.showSpinner).toBe(true);
  });

  it('returns "no-results" with the typed query echoed back', () => {
    const r = deriveSearchState({
      query: '  unicorn ',
      isFetching: false,
      results: [],
      error: null,
    });
    expect(r.kind).toBe('no-results');
    expect(r.copy).toContain('unicorn');
  });

  it('returns "has-results" with a singular vs. plural count', () => {
    const r1 = deriveSearchState({
      query: 'qq',
      isFetching: false,
      results: [{}],
      error: null,
    });
    expect(r1.kind).toBe('has-results');
    expect(r1.copy).toBe('1 result');
    const r2 = deriveSearchState({
      query: 'qq',
      isFetching: false,
      results: [{}, {}, {}],
      error: null,
    });
    expect(r2.copy).toBe('3 results');
  });

  it('surfaces rate-limit retry-after in the result', () => {
    const r = deriveSearchState({
      query: 'qq',
      isFetching: false,
      results: [],
      error: { kind: 'rate-limited', retryAfterSec: 60 },
    });
    expect(r.kind).toBe('rate-limited');
    expect(r.retryAfterSec).toBe(60);
  });

  it('falls back to a 30s retry-after when the server omits one', () => {
    const r = deriveSearchState({
      query: 'qq',
      isFetching: false,
      results: [],
      error: { kind: 'rate-limited' },
    });
    expect(r.retryAfterSec).toBe(30);
  });

  it('returns "error" with offline copy on a network error', () => {
    const r = deriveSearchState({
      query: 'qq',
      isFetching: false,
      results: [],
      error: { kind: 'network' },
    });
    expect(r.kind).toBe('error');
    expect(r.copy).toMatch(/Network unavailable/);
  });
});
