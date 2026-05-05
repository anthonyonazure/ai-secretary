import type { BotSessionStatusWire, BotSourceWire } from './schemas/bot-sessions.js';

export type BotSessionDisplayTone = 'idle' | 'progress' | 'live' | 'success' | 'error';

export interface BotSessionDisplayCopy {
  label: string;
  tone: BotSessionDisplayTone;
}

const SOURCE_LABEL: Record<BotSourceWire, string> = {
  zoom_bot: 'Zoom',
  teams_bot: 'Teams',
};

export const deriveBotSessionDisplay = (status: BotSessionStatusWire): BotSessionDisplayCopy => {
  switch (status) {
    case 'provisioning':
      return { label: 'Joining…', tone: 'progress' };
    case 'joined':
      return { label: 'Live', tone: 'live' };
    case 'ended':
      return { label: 'Ended', tone: 'success' };
    case 'failed':
      return { label: "Bot couldn't join", tone: 'error' };
  }
};

export const formatBotSessionTitle = (
  source: BotSourceWire,
  status: BotSessionStatusWire,
): string => {
  return `${SOURCE_LABEL[source]} bot · ${deriveBotSessionDisplay(status).label}`;
};

/**
 * A bot session is "active" while it is provisioning or joined — an
 * additional invite would be a no-op or step on the existing one.
 */
export const isBotSessionActive = (status: BotSessionStatusWire): boolean =>
  status === 'provisioning' || status === 'joined';

/**
 * Pick the most relevant session from a list for badge display. Active
 * (provisioning|joined) sessions win over ended/failed; among equal-
 * priority entries, the most recently created wins.
 */
export const pickPrimaryBotSession = <
  T extends { status: BotSessionStatusWire; createdAt: string },
>(
  sessions: readonly T[],
): T | null => {
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => {
    const aActive = isBotSessionActive(a.status);
    const bActive = isBotSessionActive(b.status);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return sorted[0] ?? null;
};
