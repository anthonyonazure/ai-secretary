import { describe, expect, it } from 'vitest';

import { computeBucket, computeDedupKey } from './dedup-bucket.js';

describe('computeBucket', () => {
  it('renders minute buckets as YYYYMMDDHHmm', () => {
    const bucket = computeBucket('minute', new Date('2026-04-30T10:32:00Z'));
    expect(bucket).toBe('202604301032');
  });

  it('renders hour buckets as YYYYMMDDHH', () => {
    expect(computeBucket('hour', new Date('2026-04-30T10:32:00Z'))).toBe('2026043010');
  });

  it('renders day buckets as YYYYMMDD', () => {
    expect(computeBucket('day', new Date('2026-04-30T10:32:00Z'))).toBe('20260430');
  });

  it('renders week buckets in ISO 8601 form', () => {
    // 2026-04-30 is a Thursday → ISO week 18.
    expect(computeBucket('week', new Date('2026-04-30T10:32:00Z'))).toMatch(/^2026-W\d{2}$/);
  });

  it('rolls forward at midnight UTC for day cadence', () => {
    const a = computeBucket('day', new Date('2026-04-30T23:59:59Z'));
    const b = computeBucket('day', new Date('2026-05-01T00:00:00Z'));
    expect(a).not.toBe(b);
    expect(a).toBe('20260430');
    expect(b).toBe('20260501');
  });
});

describe('computeDedupKey', () => {
  it('combines signal + scope + bucket label', () => {
    const key = computeDedupKey({
      signal: 'capture-at-risk',
      scopeId: 'rec-123',
      cadence: 'hour',
      now: new Date('2026-04-30T10:32:00Z'),
    });
    expect(key).toBe('capture-at-risk:rec-123:2026043010');
  });

  it('returns the same key inside the same bucket', () => {
    const a = computeDedupKey({
      signal: 'trial-reminder-T-3d',
      scopeId: 'tenant-1',
      cadence: 'day',
      now: new Date('2026-04-30T08:00:00Z'),
    });
    const b = computeDedupKey({
      signal: 'trial-reminder-T-3d',
      scopeId: 'tenant-1',
      cadence: 'day',
      now: new Date('2026-04-30T22:00:00Z'),
    });
    expect(a).toBe(b);
  });

  it('returns different keys when the cadence differs', () => {
    const minute = computeDedupKey({
      signal: 's',
      scopeId: '1',
      cadence: 'minute',
      now: new Date('2026-04-30T10:00:00Z'),
    });
    const hour = computeDedupKey({
      signal: 's',
      scopeId: '1',
      cadence: 'hour',
      now: new Date('2026-04-30T10:00:00Z'),
    });
    expect(minute).not.toBe(hour);
  });
});
