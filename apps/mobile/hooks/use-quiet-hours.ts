export type NotificationCriticality = 'critical' | 'normal' | 'background';

export type QuietHoursInput = {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  nowMinuteOfDay: number;
  notificationKind: NotificationCriticality;
};

export type QuietHoursResult = {
  isQuietNow: boolean;
  shouldSuppress: boolean;
  reason: 'disabled' | 'outside-window' | 'critical-bypass' | 'suppressed' | 'background';
};

const MIDNIGHT = 0;
const FULL_DAY = 24 * 60;

const isInsideWindow = (minute: number, start: number, end: number): boolean => {
  if (start === end) return false;
  if (start < end) {
    return minute >= start && minute < end;
  }
  return minute >= start || minute < end;
};

export const evaluateQuietHours = (input: QuietHoursInput): QuietHoursResult => {
  if (!input.enabled) {
    return { isQuietNow: false, shouldSuppress: false, reason: 'disabled' };
  }
  const start = ((input.startMinute % FULL_DAY) + FULL_DAY) % FULL_DAY;
  const end = ((input.endMinute % FULL_DAY) + FULL_DAY) % FULL_DAY;
  const now = ((input.nowMinuteOfDay % FULL_DAY) + FULL_DAY) % FULL_DAY;
  const isQuietNow = isInsideWindow(now, start, end);
  if (!isQuietNow) {
    return { isQuietNow: false, shouldSuppress: false, reason: 'outside-window' };
  }
  if (input.notificationKind === 'critical') {
    return { isQuietNow: true, shouldSuppress: false, reason: 'critical-bypass' };
  }
  if (input.notificationKind === 'background') {
    return { isQuietNow: true, shouldSuppress: true, reason: 'background' };
  }
  return { isQuietNow: true, shouldSuppress: true, reason: 'suppressed' };
};

export const minuteOfDay = (date: Date): number => {
  return date.getHours() * 60 + date.getMinutes();
};

export const QUIET_HOURS_MIDNIGHT = MIDNIGHT;
