import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatDurationMs,
  formatRelativeTime,
  formatTimestampMs,
  pluralize,
  truncate,
} from './format.js';

describe('formatBytes', () => {
  it('formats sub-1KB as bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats KB / MB / GB with one decimal under 10, rounded above', () => {
    expect(formatBytes(2 * 1024)).toBe('2.0 KB');
    expect(formatBytes(15 * 1024)).toBe('15 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });

  it('returns "—" on invalid inputs', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('formatDurationMs', () => {
  it('formats minutes:seconds under an hour', () => {
    expect(formatDurationMs(0)).toBe('0:00');
    expect(formatDurationMs(65_000)).toBe('1:05');
    expect(formatDurationMs(59 * 60_000)).toBe('59:00');
  });

  it('formats hours:minutes:seconds when ≥ 1 hour', () => {
    expect(formatDurationMs(60 * 60_000)).toBe('1:00:00');
    expect(formatDurationMs(60 * 60_000 + 5 * 60_000 + 7 * 1000)).toBe('1:05:07');
  });

  it('returns "—" on invalid input', () => {
    expect(formatDurationMs(-1)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  const now = 1_700_000_000_000;

  it('returns "just now" inside 30 seconds', () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe('just now');
  });

  it('returns "N min ago" inside an hour', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
  });

  it('returns "Nh ago" inside a day', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago');
  });

  it('returns "Nd ago" inside a week', () => {
    expect(formatRelativeTime(now - 4 * 24 * 60 * 60_000, now)).toBe('4d ago');
  });

  it('returns "Nw ago" inside a month-ish', () => {
    expect(formatRelativeTime(now - 21 * 24 * 60 * 60_000, now)).toBe('3w ago');
  });

  it('returns "Nmo ago" past a month', () => {
    expect(formatRelativeTime(now - 90 * 24 * 60 * 60_000, now)).toBe('3mo ago');
  });

  it('returns "in N min" for future times', () => {
    expect(formatRelativeTime(now + 5 * 60_000, now)).toBe('in 5 min');
  });
});

describe('formatTimestampMs', () => {
  it('formats minute:second.hundredths', () => {
    expect(formatTimestampMs(0)).toBe('0:00.00');
    expect(formatTimestampMs(65_040)).toBe('1:05.04');
    expect(formatTimestampMs(125_990)).toBe('2:05.99');
  });

  it('returns 0:00 on bad input', () => {
    expect(formatTimestampMs(-1)).toBe('0:00');
  });
});

describe('truncate', () => {
  it('returns the string unchanged when under the limit', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('appends an ellipsis when over the limit', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
  });

  it('trims trailing whitespace before the ellipsis', () => {
    expect(truncate('hello   world', 8)).toBe('hello…');
  });

  it('handles a max smaller than the ellipsis', () => {
    expect(truncate('whatever', 1)).toBe('…');
  });
});

describe('pluralize', () => {
  it('uses the singular at exactly one', () => {
    expect(pluralize(1, 'meeting')).toBe('1 meeting');
  });

  it('uses the plural otherwise', () => {
    expect(pluralize(0, 'meeting')).toBe('0 meetings');
    expect(pluralize(2, 'meeting')).toBe('2 meetings');
  });

  it('honors a custom plural', () => {
    expect(pluralize(2, 'criterion', 'criteria')).toBe('2 criteria');
  });
});
