import { describe, expect, it } from 'vitest';

import { aggregateMeetingThumbs } from './use-meeting-thumbs-aggregator.js';

const row = (
  overrides: Partial<Parameters<typeof aggregateMeetingThumbs>[0]['rows'][number]> = {},
) => ({
  meetingId: 'm1',
  userId: 'u1',
  kind: 'up' as const,
  submittedAtMs: 1_700_000_000_000,
  receiptOrdinal: 1,
  ...overrides,
});

describe('aggregateMeetingThumbs', () => {
  it('counts up vs down inside the window', () => {
    const r = aggregateMeetingThumbs({
      rows: [row({ kind: 'up' }), row({ kind: 'up' }), row({ kind: 'down' })],
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
    });
    expect(r.total).toBe(3);
    expect(r.up).toBe(2);
    expect(r.down).toBe(1);
    expect(r.positiveRate).toBeCloseTo(2 / 3);
  });

  it('drops rows outside the window', () => {
    const r = aggregateMeetingThumbs({
      rows: [row({ submittedAtMs: 100 }), row({ submittedAtMs: 5_000 })],
      windowStartMs: 1_000,
      windowEndMs: 10_000,
    });
    expect(r.total).toBe(1);
  });

  it('isolates a polish-window subset (first 3 receipts)', () => {
    const r = aggregateMeetingThumbs({
      rows: [
        row({ kind: 'up', receiptOrdinal: 1 }),
        row({ kind: 'up', receiptOrdinal: 2 }),
        row({ kind: 'down', receiptOrdinal: 3 }),
        row({ kind: 'up', receiptOrdinal: 8 }),
      ],
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
    });
    expect(r.polishWindow.total).toBe(3);
    expect(r.polishWindow.positiveRate).toBeCloseTo(2 / 3);
  });

  it('flags belowAlarmThreshold only when volume + rate threshold are both crossed', () => {
    const lowVolumeBadRate = aggregateMeetingThumbs({
      rows: Array.from({ length: 10 }, () => row({ kind: 'down' })),
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
    });
    expect(lowVolumeBadRate.belowAlarmThreshold).toBe(false);

    const highVolumeBadRate = aggregateMeetingThumbs({
      rows: [
        ...Array.from({ length: 60 }, () => row({ kind: 'down' })),
        ...Array.from({ length: 40 }, () => row({ kind: 'up' })),
      ],
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
    });
    expect(highVolumeBadRate.belowAlarmThreshold).toBe(true);
  });

  it('does not flag belowAlarmThreshold when rate is good', () => {
    const r = aggregateMeetingThumbs({
      rows: Array.from({ length: 200 }, () => row({ kind: 'up' })),
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
    });
    expect(r.belowAlarmThreshold).toBe(false);
  });

  it('returns 0 positive rate on no rows', () => {
    const r = aggregateMeetingThumbs({
      rows: [],
      windowStartMs: 0,
      windowEndMs: 1_000,
    });
    expect(r.positiveRate).toBe(0);
    expect(r.polishWindow.positiveRate).toBe(0);
  });

  it('honors a custom polish-window N', () => {
    const r = aggregateMeetingThumbs({
      rows: [
        row({ kind: 'up', receiptOrdinal: 1 }),
        row({ kind: 'up', receiptOrdinal: 2 }),
        row({ kind: 'up', receiptOrdinal: 5 }),
      ],
      windowStartMs: 0,
      windowEndMs: 2_000_000_000_000,
      polishWindowReceiptN: 5,
    });
    expect(r.polishWindow.total).toBe(3);
  });
});
