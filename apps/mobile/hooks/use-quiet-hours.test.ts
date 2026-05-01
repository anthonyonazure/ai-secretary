import { describe, expect, it } from 'vitest';

import { evaluateQuietHours, minuteOfDay } from './use-quiet-hours.js';

describe('evaluateQuietHours', () => {
  it('returns disabled when quiet hours are off', () => {
    const r = evaluateQuietHours({
      enabled: false,
      startMinute: 22 * 60,
      endMinute: 7 * 60,
      nowMinuteOfDay: 23 * 60,
      notificationKind: 'normal',
    });
    expect(r.shouldSuppress).toBe(false);
    expect(r.reason).toBe('disabled');
  });

  it('detects quiet inside a wrap-around overnight window', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 22 * 60,
      endMinute: 7 * 60,
      nowMinuteOfDay: 1 * 60,
      notificationKind: 'normal',
    });
    expect(r.isQuietNow).toBe(true);
    expect(r.shouldSuppress).toBe(true);
  });

  it('detects outside the wrap-around window during the day', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 22 * 60,
      endMinute: 7 * 60,
      nowMinuteOfDay: 12 * 60,
      notificationKind: 'normal',
    });
    expect(r.isQuietNow).toBe(false);
    expect(r.reason).toBe('outside-window');
  });

  it('lets critical notifications bypass quiet hours', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 22 * 60,
      endMinute: 7 * 60,
      nowMinuteOfDay: 2 * 60,
      notificationKind: 'critical',
    });
    expect(r.isQuietNow).toBe(true);
    expect(r.shouldSuppress).toBe(false);
    expect(r.reason).toBe('critical-bypass');
  });

  it('always suppresses background notifications during quiet hours', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 22 * 60,
      endMinute: 7 * 60,
      nowMinuteOfDay: 6 * 60,
      notificationKind: 'background',
    });
    expect(r.shouldSuppress).toBe(true);
    expect(r.reason).toBe('background');
  });

  it('handles a same-day window correctly', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 13 * 60,
      endMinute: 14 * 60,
      nowMinuteOfDay: 13 * 60 + 30,
      notificationKind: 'normal',
    });
    expect(r.isQuietNow).toBe(true);
  });

  it('treats start === end as a no-op window', () => {
    const r = evaluateQuietHours({
      enabled: true,
      startMinute: 6 * 60,
      endMinute: 6 * 60,
      nowMinuteOfDay: 6 * 60,
      notificationKind: 'normal',
    });
    expect(r.isQuietNow).toBe(false);
  });
});

describe('minuteOfDay', () => {
  it('converts a Date into minutes since local midnight', () => {
    expect(minuteOfDay(new Date('2026-04-30T00:00:00'))).toBe(0);
    expect(minuteOfDay(new Date('2026-04-30T13:30:00'))).toBe(13 * 60 + 30);
    expect(minuteOfDay(new Date('2026-04-30T23:59:00'))).toBe(23 * 60 + 59);
  });
});
