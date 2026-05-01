export type BotJoinStatus =
  | 'scheduled'
  | 'joining'
  | 'recording'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type BotStatusInput = {
  status: BotJoinStatus;
  scheduledStartMs: number;
  joinedAtMs: number | null;
  endedAtMs: number | null;
  lastHeartbeatMs: number | null;
  now?: number;
};

export type BotStatusResult = {
  label: string;
  tone: 'idle' | 'progress' | 'live' | 'warning' | 'success' | 'error';
  showFallbackCta: boolean;
};

const HEARTBEAT_AT_RISK_MS = 90_000;

export const deriveBotStatus = (input: BotStatusInput): BotStatusResult => {
  const now = input.now ?? Date.now();
  switch (input.status) {
    case 'scheduled': {
      const startsInMs = input.scheduledStartMs - now;
      if (startsInMs <= 0) {
        return { label: 'Joining now', tone: 'progress', showFallbackCta: false };
      }
      const minutes = Math.ceil(startsInMs / 60_000);
      return { label: `Joining in ${minutes} min`, tone: 'idle', showFallbackCta: false };
    }
    case 'joining':
      return { label: 'Joining…', tone: 'progress', showFallbackCta: false };
    case 'recording': {
      const last = input.lastHeartbeatMs;
      if (last !== null && now - last > HEARTBEAT_AT_RISK_MS) {
        return {
          label: 'Connection unstable',
          tone: 'warning',
          showFallbackCta: false,
        };
      }
      return { label: 'Live', tone: 'live', showFallbackCta: false };
    }
    case 'reconnecting':
      return {
        label: 'Reconnecting…',
        tone: 'warning',
        showFallbackCta: true,
      };
    case 'ended':
      return { label: 'Ended', tone: 'success', showFallbackCta: false };
    case 'failed':
      return {
        label: 'Bot couldn’t join — try cloud recording',
        tone: 'error',
        showFallbackCta: true,
      };
  }
};
