/**
 * `usePaginationCursor` — pure helper for the inbox + my-actions
 * cursor-paginated lists.
 *
 * Tracks fetched pages, dedup by stable id, and computes the next
 * cursor token from the most recent page. The native screen calls
 * `appendPage(response)` after each fetch and reads `items` for the
 * FlatList data source.
 */

export interface PaginatedResponse<T extends { id: string }> {
  items: T[];
  nextCursor: string | null;
}

export interface PaginationState<T extends { id: string }> {
  items: T[];
  nextCursor: string | null;
  /** True when the most recent response had `nextCursor === null`. */
  exhausted: boolean;
}

export const initialPagination = <T extends { id: string }>(): PaginationState<T> => ({
  items: [],
  nextCursor: null,
  exhausted: false,
});

/**
 * Append a new page. Dedups by `id` so re-fetching the same cursor
 * (e.g. on retry) doesn't duplicate rows.
 */
export const appendPage = <T extends { id: string }>(
  state: PaginationState<T>,
  page: PaginatedResponse<T>,
): PaginationState<T> => {
  const seen = new Set(state.items.map((i) => i.id));
  const additions = page.items.filter((i) => !seen.has(i.id));
  return {
    items: [...state.items, ...additions],
    nextCursor: page.nextCursor,
    exhausted: page.nextCursor === null,
  };
};

/**
 * Reset to the initial state — used on pull-to-refresh.
 */
export const resetPagination = <T extends { id: string }>(
  next: PaginatedResponse<T>,
): PaginationState<T> => ({
  items: [...next.items],
  nextCursor: next.nextCursor,
  exhausted: next.nextCursor === null,
});

/**
 * Replace an item in the list (e.g. after a status mutation). No-op
 * when the id isn't present.
 */
export const replaceItem = <T extends { id: string }>(
  state: PaginationState<T>,
  next: T,
): PaginationState<T> => {
  const idx = state.items.findIndex((i) => i.id === next.id);
  if (idx === -1) return state;
  const items = [...state.items];
  items[idx] = next;
  return { ...state, items };
};
