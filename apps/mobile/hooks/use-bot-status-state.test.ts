import { describe, expect, it } from 'vitest';

import { deriveBotStatus } from './use-bot-status-state.js';

describe('deriveBotStatus', () => {
  it('shows minutes-until-start before a scheduled join', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'scheduled',
      scheduledStartMs: now + 4 * 60_000 + 30_000,
      joinedAtMs: null,
      endedAtMs: null,
      lastHeartbeatMs: null,
      now,
    });
    expect(r.label).toBe('Joining in 5 min');
    expect(r.tone).toBe('idle');
  });

  it('flips to "Joining now" once the scheduled start has passed', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'scheduled',
      scheduledStartMs: now - 10_000,
      joinedAtMs: null,
      endedAtMs: null,
      lastHeartbeatMs: null,
      now,
    });
    expect(r.label).toBe('Joining now');
    expect(r.tone).toBe('progress');
  });

  it('returns "Live" while recording with a fresh heartbeat', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'recording',
      scheduledStartMs: now - 5 * 60_000,
      joinedAtMs: now - 4 * 60_000,
      endedAtMs: null,
      lastHeartbeatMs: now - 10_000,
      now,
    });
    expect(r.label).toBe('Live');
    expect(r.tone).toBe('live');
  });

  it('flags an unstable connection when heartbeat is past the 90s threshold', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'recording',
      scheduledStartMs: now - 5 * 60_000,
      joinedAtMs: now - 4 * 60_000,
      endedAtMs: null,
      lastHeartbeatMs: now - 100_000,
      now,
    });
    expect(r.label).toBe('Connection unstable');
    expect(r.tone).toBe('warning');
  });

  it('offers cloud-recording fallback on a failed bot join', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'failed',
      scheduledStartMs: now - 60_000,
      joinedAtMs: null,
      endedAtMs: null,
      lastHeartbeatMs: null,
      now,
    });
    expect(r.tone).toBe('error');
    expect(r.showFallbackCta).toBe(true);
  });

  it('offers fallback CTA during reconnect attempts', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'reconnecting',
      scheduledStartMs: now - 10 * 60_000,
      joinedAtMs: now - 9 * 60_000,
      endedAtMs: null,
      lastHeartbeatMs: now - 30_000,
      now,
    });
    expect(r.label).toBe('Reconnecting…');
    expect(r.showFallbackCta).toBe(true);
  });

  it('returns "Ended" once the bot leaves cleanly', () => {
    const now = 1_700_000_000_000;
    const r = deriveBotStatus({
      status: 'ended',
      scheduledStartMs: now - 60 * 60_000,
      joinedAtMs: now - 50 * 60_000,
      endedAtMs: now - 5 * 60_000,
      lastHeartbeatMs: now - 5 * 60_000,
      now,
    });
    expect(r.label).toBe('Ended');
    expect(r.tone).toBe('success');
  });
});
