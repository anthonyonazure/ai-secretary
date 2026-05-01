import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type BotNotificationEnqueuer,
  type BotWatchdogReader,
  type InFlightBotSession,
  runBotWatchdog,
} from './bot-watchdog.js';
import type { WatchdogHeartbeatStore } from './recording-watchdog.js';

const buildHeartbeatStore = (): WatchdogHeartbeatStore & {
  __setLost: (key: string) => void;
  __setFired: (key: string) => void;
  __getFired: () => string[];
} => {
  const lostKeys = new Set<string>();
  const firedKeys = new Set<string>();
  return {
    setHeartbeat: vi.fn(),
    isHeartbeatLost: vi.fn(async (key: string) => lostKeys.has(key)),
    hasWatchdogFired: vi.fn(async (key: string) => firedKeys.has(key)),
    markWatchdogFired: vi.fn(async (key: string) => {
      firedKeys.add(key);
    }),
    __setLost: (key: string) => lostKeys.add(key),
    __setFired: (key: string) => firedKeys.add(key),
    __getFired: () => [...firedKeys],
  } as unknown as WatchdogHeartbeatStore & {
    __setLost: (key: string) => void;
    __setFired: (key: string) => void;
    __getFired: () => string[];
  };
};

const buildEnqueuer = (): BotNotificationEnqueuer & { __getCalls: () => unknown[] } => {
  const calls: unknown[] = [];
  return {
    enqueueBotJoinFailed: vi.fn(async (input) => {
      calls.push(input);
    }),
    __getCalls: () => calls,
  } as unknown as BotNotificationEnqueuer & { __getCalls: () => unknown[] };
};

const buildSession = (): InFlightBotSession => ({
  tenantId: randomUUID(),
  sessionId: randomUUID(),
  ownerUserId: randomUUID(),
  meetingId: randomUUID(),
  region: 'us',
  source: 'zoom_bot',
});

describe('bot-watchdog', () => {
  it('skips sessions whose heartbeat is fresh', async () => {
    const session = buildSession();
    const reader: BotWatchdogReader = { listInFlight: async () => [session] };
    const store = buildHeartbeatStore();
    const enq = buildEnqueuer();
    const result = await runBotWatchdog({
      reader,
      heartbeatStore: store,
      notificationEnqueuer: enq,
      logger: pino({ level: 'silent' }),
      now: () => 1_700_000_000_000,
    });
    expect(result.enqueued).toBe(0);
    expect(enq.__getCalls()).toEqual([]);
  });

  it('enqueues a bot-join-failed notification when the heartbeat is lost', async () => {
    const session = buildSession();
    const reader: BotWatchdogReader = { listInFlight: async () => [session] };
    const store = buildHeartbeatStore();
    store.__setLost(`bot:${session.sessionId}`);
    const enq = buildEnqueuer();
    const result = await runBotWatchdog({
      reader,
      heartbeatStore: store,
      notificationEnqueuer: enq,
      logger: pino({ level: 'silent' }),
      now: () => 1_700_000_000_000,
    });
    expect(result.enqueued).toBe(1);
    const call = enq.__getCalls()[0] as { source: string; sessionId: string };
    expect(call.source).toBe('zoom_bot');
    expect(call.sessionId).toBe(session.sessionId);
  });

  it('suppresses duplicate dispatches when the watchdog already fired', async () => {
    const session = buildSession();
    const reader: BotWatchdogReader = { listInFlight: async () => [session] };
    const store = buildHeartbeatStore();
    store.__setLost(`bot:${session.sessionId}`);
    store.__setFired(`bot:${session.sessionId}`);
    const enq = buildEnqueuer();
    const result = await runBotWatchdog({
      reader,
      heartbeatStore: store,
      notificationEnqueuer: enq,
      logger: pino({ level: 'silent' }),
      now: () => 1_700_000_000_000,
    });
    expect(result.suppressed).toBe(1);
    expect(result.enqueued).toBe(0);
    expect(enq.__getCalls()).toEqual([]);
  });

  it('continues when one session enqueue fails', async () => {
    const a = buildSession();
    const b = buildSession();
    const reader: BotWatchdogReader = { listInFlight: async () => [a, b] };
    const store = buildHeartbeatStore();
    store.__setLost(`bot:${a.sessionId}`);
    store.__setLost(`bot:${b.sessionId}`);
    let attempt = 0;
    const enq: BotNotificationEnqueuer & { __getCalls: () => unknown[] } = {
      enqueueBotJoinFailed: vi.fn(async (input) => {
        attempt += 1;
        if (attempt === 1) throw new Error('queue down');
        calls.push(input);
      }),
      __getCalls: () => calls,
    } as unknown as BotNotificationEnqueuer & { __getCalls: () => unknown[] };
    const calls: unknown[] = [];
    const result = await runBotWatchdog({
      reader,
      heartbeatStore: store,
      notificationEnqueuer: enq,
      logger: pino({ level: 'silent' }),
      now: () => 1_700_000_000_000,
    });
    expect(result.scanned).toBe(2);
    expect(result.enqueued).toBe(1);
    expect(enq.__getCalls()).toHaveLength(1);
  });
});
