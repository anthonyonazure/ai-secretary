/**
 * `deriveBotWatchdogCard` — UX state for the bot-watchdog inline card
 * that appears on the meeting detail screen when the bot is connected
 * to the actual meeting.
 *
 * Mirrors `recording-watchdog` semantics for the bot-service path:
 * heartbeat freshness, retry budget, escalation push.
 */

export type BotWatchdogInput = {
  botStatus: 'idle' | 'joining' | 'live' | 'reconnecting' | 'ended' | 'failed';
  lastHeartbeatMs: number | null;
  retryAttempts: number;
  scheduledRetryAtMs: number | null;
  fallbackOffered: boolean;
  now?: number;
};

export type BotWatchdogCardState = {
  display: 'hidden' | 'idle' | 'live' | 'reconnecting' | 'failed' | 'recovered';
  primaryCopy: string;
  secondaryCopy: string | null;
  showFallbackCta: boolean;
  showRetryCountdownSec: number | null;
};

const HEARTBEAT_FRESH_MS = 30_000;
const HEARTBEAT_AT_RISK_MS = 90_000;

export const deriveBotWatchdogCard = (input: BotWatchdogInput): BotWatchdogCardState => {
  const now = input.now ?? Date.now();
  if (input.botStatus === 'idle' || input.botStatus === 'ended') {
    return {
      display: 'hidden',
      primaryCopy: '',
      secondaryCopy: null,
      showFallbackCta: false,
      showRetryCountdownSec: null,
    };
  }

  if (input.botStatus === 'joining') {
    return {
      display: 'idle',
      primaryCopy: 'Bot is joining the meeting…',
      secondaryCopy: null,
      showFallbackCta: false,
      showRetryCountdownSec: null,
    };
  }

  if (input.botStatus === 'failed') {
    return {
      display: 'failed',
      primaryCopy: 'Bot couldn’t join.',
      secondaryCopy: 'Pull from Zoom Cloud once the meeting ends, or upload manually.',
      showFallbackCta: true,
      showRetryCountdownSec: null,
    };
  }

  if (input.botStatus === 'reconnecting') {
    const sec =
      input.scheduledRetryAtMs !== null
        ? Math.max(0, Math.ceil((input.scheduledRetryAtMs - now) / 1000))
        : null;
    return {
      display: 'reconnecting',
      primaryCopy: 'Bot connection unstable — reconnecting.',
      secondaryCopy:
        input.retryAttempts > 0
          ? `Attempt ${input.retryAttempts} of 3. Falling back to cloud recording if this fails.`
          : null,
      showFallbackCta: input.fallbackOffered,
      showRetryCountdownSec: sec,
    };
  }

  // live
  const lastHeartbeat = input.lastHeartbeatMs;
  if (lastHeartbeat !== null && now - lastHeartbeat > HEARTBEAT_AT_RISK_MS) {
    return {
      display: 'reconnecting',
      primaryCopy: 'Bot heartbeat lost.',
      secondaryCopy: 'Trying to reconnect — your meeting is still being captured locally.',
      showFallbackCta: true,
      showRetryCountdownSec: null,
    };
  }
  if (lastHeartbeat !== null && now - lastHeartbeat > HEARTBEAT_FRESH_MS) {
    return {
      display: 'live',
      primaryCopy: 'Bot capture live.',
      secondaryCopy: 'Last heartbeat a moment ago.',
      showFallbackCta: false,
      showRetryCountdownSec: null,
    };
  }
  if (input.retryAttempts > 0) {
    return {
      display: 'recovered',
      primaryCopy: 'Bot reconnected.',
      secondaryCopy: null,
      showFallbackCta: false,
      showRetryCountdownSec: null,
    };
  }
  return {
    display: 'live',
    primaryCopy: 'Bot capture live.',
    secondaryCopy: null,
    showFallbackCta: false,
    showRetryCountdownSec: null,
  };
};
