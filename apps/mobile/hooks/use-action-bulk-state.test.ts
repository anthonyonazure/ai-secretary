import { describe, expect, it } from 'vitest';

import { type ActionItemSelection, deriveBulkActionAvailability } from './use-action-bulk-state.js';

const item = (overrides: Partial<ActionItemSelection> = {}): ActionItemSelection => ({
  id: 'a-1',
  status: 'open',
  ownerUserId: 'u-1',
  ...overrides,
});

describe('deriveBulkActionAvailability', () => {
  it('disables all bulk actions when nothing is selected', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: [],
      items: [item({ id: 'a-1' }), item({ id: 'a-2' })],
    });
    expect(r.canMarkDone).toBe(false);
    expect(r.canReassign).toBe(false);
    expect(r.selectedCount).toBe(0);
  });

  it('enables mark-done when at least one item is not yet done', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: ['a-1', 'a-2'],
      items: [item({ id: 'a-1', status: 'open' }), item({ id: 'a-2', status: 'in-progress' })],
    });
    expect(r.canMarkDone).toBe(true);
    expect(r.mixedStatuses).toBe(true);
  });

  it('disables mark-done when every selected item is already done', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: ['a-1', 'a-2'],
      items: [item({ id: 'a-1', status: 'done' }), item({ id: 'a-2', status: 'done' })],
    });
    expect(r.canMarkDone).toBe(false);
    expect(r.mixedStatuses).toBe(false);
  });

  it('disables mark-in-progress only when ALL selected items are already in-progress', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: ['a-1', 'a-2'],
      items: [
        item({ id: 'a-1', status: 'in-progress' }),
        item({ id: 'a-2', status: 'in-progress' }),
      ],
    });
    expect(r.canMarkInProgress).toBe(false);
  });

  it('reports the count of items currently selected', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: ['a-1', 'a-2', 'missing'],
      items: [item({ id: 'a-1' }), item({ id: 'a-2' })],
    });
    expect(r.selectedCount).toBe(2);
  });

  it('always allows reassign + delete when something is selected', () => {
    const r = deriveBulkActionAvailability({
      selectedIds: ['a-1'],
      items: [item({ id: 'a-1', status: 'done' })],
    });
    expect(r.canReassign).toBe(true);
    expect(r.canDelete).toBe(true);
  });
});
