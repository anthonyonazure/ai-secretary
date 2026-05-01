/**
 * Pure formatting helpers shared across web + mobile + workers.
 *
 * Locale-aware where it matters; otherwise returns stable canonical
 * forms. No I/O, no React deps.
 */

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0] ?? 'KB';
  for (const u of units) {
    if (value < 1024) {
      unit = u;
      break;
    }
    value /= 1024;
    unit = u;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
};

export const formatDurationMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatRelativeTime = (ms: number, now: number = Date.now()): string => {
  const diff = now - ms;
  const future = diff < 0;
  const absDiff = Math.abs(diff);
  const sec = Math.floor(absDiff / 1000);
  if (sec < 30) return 'just now';
  if (sec < 60) return future ? 'in less than a minute' : 'less than a minute ago';
  const minutes = Math.floor(sec / 60);
  if (minutes < 60) {
    return future ? `in ${minutes} min` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return future ? `in ${days}d` : `${days}d ago`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return future ? `in ${weeks}w` : `${weeks}w ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return future ? `in ${months}mo` : `${months}mo ago`;
  }
  const years = Math.floor(days / 365);
  return future ? `in ${years}y` : `${years}y ago`;
};

/** "1:23.04" — minutes:seconds.hundredths, for citation timestamp display. */
export const formatTimestampMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
};

export const truncate = (text: string, max: number, ellipsis = '…'): string => {
  if (text.length <= max) return text;
  if (max <= ellipsis.length) return ellipsis.slice(0, max);
  return `${text.slice(0, max - ellipsis.length).trimEnd()}${ellipsis}`;
};

export const pluralize = (count: number, singular: string, plural?: string): string => {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${word}`;
};
