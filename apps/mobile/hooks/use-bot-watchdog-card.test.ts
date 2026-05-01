import { describe, expect, it } from 'vitest';

import { deriveBotWatchdogCard } from './use-bot-watchdog-card.js';

const baseInput = {
  botStatus: 'live' as const,
  lastHeartbeatMs: 1_700_000_000_000,
  retryAttempts: 0,
  scheduledRetryAtMs: null,
  fallbackOffered: false,
};

describe('deriveBotWatchdogCard', () => {
  it('hides the card when bot is idle', () => {
    const r = deriveBotWatchdogCard({ ...baseInput, botStatus: 'idle' });
    expect(r.display).toBe('hidden');
  });

  it('hides the card after the bot ends cleanly', () => {
    const r = deriveBotWatchdogCard({ ...baseInput, botStatus: 'ended' });
    expect(r.display).toBe('hidden');
  });

  it('shows joining state', () => {
    const r = deriveBotWatchdogCard({ ...baseInput, botStatus: 'joining' });
    expect(r.display).toBe('idle');
    expect(r.primaryCopy).toMatch(/joining/i);
  });

  it('shows live with a fresh heartbeat', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotWatchdogCard({
      ...baseInput,
      lastHeartbeatMs: now - 5_000,
      now,
    });
    expect(r.display).toBe('live');
    expect(r.primaryCopy).toMatch(/Bot capture live/);
  });

  it('flags reconnecting when heartbeat is older than 90s', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotWatchdogCard({
      ...baseInput,
      lastHeartbeatMs: now - 100_000,
      now,
    });
    expect(r.display).toBe('reconnecting');
    expect(r.primaryCopy).toMatch(/heartbeat lost/);
    expect(r.showFallbackCta).toBe(true);
  });

  it('shows reconnecting with retry countdown', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotWatchdogCard({
      ...baseInput,
      botStatus: 'reconnecting',
      retryAttempts: 1,
      scheduledRetryAtMs: now + 10_000,
      now,
    });
    expect(r.display).toBe('reconnecting');
    expect(r.showRetryCountdownSec).toBe(10);
  });

  it('shows failed with fallback CTA on a hard failure', () => {
    const r = deriveBotWatchdogCard({ ...baseInput, botStatus: 'failed' });
    expect(r.display).toBe('failed');
    expect(r.showFallbackCta).toBe(true);
  });

  it('shows recovered briefly after a successful reconnect', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotWatchdogCard({
      ...baseInput,
      botStatus: 'live',
      lastHeartbeatMs: now - 5_000,
      retryAttempts: 1,
      now,
    });
    expect(r.display).toBe('recovered');
  });

  it('shows live (with stale-but-not-at-risk hint) when heartbeat is between 30s and 90s', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotWatchdogCard({
      ...baseInput,
      lastHeartbeatMs: now - 60_000,
      now,
    });
    expect(r.display).toBe('live');
    expect(r.secondaryCopy).toMatch(/heartbeat/i);
  });
});
