export type SearchEmptyKind =
  | 'idle'
  | 'pending'
  | 'no-results'
  | 'has-results'
  | 'error'
  | 'rate-limited';

export type SearchInput = {
  query: string;
  isFetching: boolean;
  results: ReadonlyArray<unknown>;
  error: { kind: 'network' | 'rate-limited' | 'server'; retryAfterSec?: number } | null;
};

export type SearchState = {
  kind: SearchEmptyKind;
  showSpinner: boolean;
  copy: string;
  retryAfterSec: number;
};

const MIN_QUERY_LENGTH = 2;

export const deriveSearchState = (input: SearchInput): SearchState => {
  if (input.error?.kind === 'rate-limited') {
    return {
      kind: 'rate-limited',
      showSpinner: false,
      copy: 'You’re searching too fast — try again in a moment.',
      retryAfterSec: input.error.retryAfterSec ?? 30,
    };
  }
  if (input.error) {
    return {
      kind: 'error',
      showSpinner: false,
      copy:
        input.error.kind === 'network'
          ? 'Network unavailable — search will resume when you’re back online.'
          : 'Search is temporarily unavailable.',
      retryAfterSec: 0,
    };
  }
  if (input.query.trim().length < MIN_QUERY_LENGTH) {
    return {
      kind: 'idle',
      showSpinner: false,
      copy: 'Search across every meeting in your tenant.',
      retryAfterSec: 0,
    };
  }
  if (input.isFetching) {
    return {
      kind: 'pending',
      showSpinner: true,
      copy: 'Searching…',
      retryAfterSec: 0,
    };
  }
  if (input.results.length === 0) {
    return {
      kind: 'no-results',
      showSpinner: false,
      copy: `No matches for “${input.query.trim()}.” Try different keywords or a phrase.`,
      retryAfterSec: 0,
    };
  }
  return {
    kind: 'has-results',
    showSpinner: false,
    copy: `${input.results.length} result${input.results.length === 1 ? '' : 's'}`,
    retryAfterSec: 0,
  };
};
