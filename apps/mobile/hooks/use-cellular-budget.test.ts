import { describe, expect, it } from 'vitest';

import { deriveCellularBudget } from './use-cellular-budget.js';

const baseInput = {
  isOnCellular: true,
  cellularBytesUsedThisMonth: 0,
  cellularMonthlyCapBytes: 1024 * 1024 * 1024,
  pendingUploadBytes: 0,
  cellularUploadsAllowed: true,
};

describe('deriveCellularBudget', () => {
  it('returns no warning when off cellular', () => {
    const r = deriveCellularBudget({ ...baseInput, isOnCellular: false });
    expect(r.warningKind).toBe('none');
    expect(r.shouldDeferUpload).toBe(false);
  });

  it('defers uploads when cellular is disallowed', () => {
    const r = deriveCellularBudget({ ...baseInput, cellularUploadsAllowed: false });
    expect(r.shouldDeferUpload).toBe(true);
    expect(r.warningKind).toBe('cellular-disallowed');
  });

  it('hard-blocks at the monthly cap', () => {
    const r = deriveCellularBudget({
      ...baseInput,
      cellularBytesUsedThisMonth: 1024 * 1024 * 1024,
    });
    expect(r.shouldDeferUpload).toBe(true);
    expect(r.warningKind).toBe('over-cap');
  });

  it('warns near the 80% threshold without deferring', () => {
    const r = deriveCellularBudget({
      ...baseInput,
      cellularBytesUsedThisMonth: 0.85 * 1024 * 1024 * 1024,
    });
    expect(r.shouldDeferUpload).toBe(false);
    expect(r.warningKind).toBe('near-cap');
    expect(r.copy).toMatch(/85%/);
  });

  it('flags large pending uploads on cellular', () => {
    const r = deriveCellularBudget({
      ...baseInput,
      pendingUploadBytes: 200 * 1024 * 1024,
    });
    expect(r.warningKind).toBe('large-pending');
    expect(r.shouldDeferUpload).toBe(false);
  });

  it('returns no warning when on cellular and well under the cap', () => {
    const r = deriveCellularBudget({
      ...baseInput,
      cellularBytesUsedThisMonth: 100 * 1024 * 1024,
      pendingUploadBytes: 10 * 1024 * 1024,
    });
    expect(r.warningKind).toBe('none');
  });

  it('handles a null cap gracefully (unmetered)', () => {
    const r = deriveCellularBudget({
      ...baseInput,
      cellularMonthlyCapBytes: null,
      cellularBytesUsedThisMonth: 50 * 1024 * 1024 * 1024,
    });
    expect(r.warningKind).toBe('none');
  });
});
