import { describe, expect, it } from 'vitest';

import {
  appendPage,
  initialPagination,
  replaceItem,
  resetPagination,
} from './use-pagination-cursor.js';

interface Item {
  id: string;
  text: string;
}

describe('initialPagination', () => {
  it('returns an empty state', () => {
    const s = initialPagination<Item>();
    expect(s.items).toEqual([]);
    expect(s.nextCursor).toBeNull();
    expect(s.exhausted).toBe(false);
  });
});

describe('appendPage', () => {
  it('appends new items', () => {
    const s = initialPagination<Item>();
    const r = appendPage(s, {
      items: [
        { id: 'a', text: '1' },
        { id: 'b', text: '2' },
      ],
      nextCursor: 'cursor-1',
    });
    expect(r.items).toHaveLength(2);
    expect(r.nextCursor).toBe('cursor-1');
    expect(r.exhausted).toBe(false);
  });

  it('marks exhausted when nextCursor is null', () => {
    const s = initialPagination<Item>();
    const r = appendPage(s, {
      items: [{ id: 'a', text: '1' }],
      nextCursor: null,
    });
    expect(r.exhausted).toBe(true);
  });

  it('dedups by id when the same item appears twice', () => {
    const s = appendPage(initialPagination<Item>(), {
      items: [{ id: 'a', text: '1' }],
      nextCursor: 'cursor-1',
    });
    const r = appendPage(s, {
      items: [
        { id: 'a', text: '1-dup' },
        { id: 'b', text: '2' },
      ],
      nextCursor: 'cursor-2',
    });
    expect(r.items).toHaveLength(2);
    // First insertion of `a` wins — the dedup is "first writer".
    expect(r.items[0]?.text).toBe('1');
  });
});

describe('resetPagination', () => {
  it('replaces the entire state with the new page', () => {
    const r = resetPagination({
      items: [{ id: 'x', text: 'fresh' }],
      nextCursor: 'cursor-x',
    });
    expect(r.items).toHaveLength(1);
    expect(r.nextCursor).toBe('cursor-x');
    expect(r.exhausted).toBe(false);
  });
});

describe('replaceItem', () => {
  it('replaces an existing item by id', () => {
    let s = appendPage(initialPagination<Item>(), {
      items: [
        { id: 'a', text: '1' },
        { id: 'b', text: '2' },
      ],
      nextCursor: null,
    });
    s = replaceItem(s, { id: 'a', text: '1-updated' });
    expect(s.items[0]?.text).toBe('1-updated');
    expect(s.items[1]?.text).toBe('2');
  });

  it('returns the original state when the id is not present', () => {
    const s = appendPage(initialPagination<Item>(), {
      items: [{ id: 'a', text: '1' }],
      nextCursor: null,
    });
    const r = replaceItem(s, { id: 'missing', text: 'x' });
    expect(r).toBe(s);
  });
});
