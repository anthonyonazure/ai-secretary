import { describe, expect, it } from 'vitest';
import {
  type InFlightRecording,
  type RecordingWatchdogDeps,
  type RecordingWatchdogReader,
  type WatchdogHeartbeatStore,
  type WatchdogNotificationEnqueuer,
  runRecordingWatchdog,
} from './recording-watchdog.js';

class FixtureReader implements RecordingWatchdogReader {
  constructor(public rows: InFlightRecording[]) {}
  async listInFlight(): Promise<InFlightRecording[]> {
    return this.rows;
  }
}

class FakeHeartbeatStore implements WatchdogHeartbeatStore {
  public readonly heartbeats = new Set<string>();
  public readonly fired = new Set<string>();
  async isHeartbeatLost(recordingId: string): Promise<boolean> {
    return !this.heartbeats.has(recordingId);
  }
  async markWatchdogFired(recordingId: string): Promise<void> {
    this.fired.add(recordingId);
  }
  async hasWatchdogFired(recordingId: string): Promise<boolean> {
    return this.fired.has(recordingId);
  }
}

class FakeNotificationEnqueuer implements WatchdogNotificationEnqueuer {
  public readonly enqueued: Array<{
    tenantId: string;
    recordingId: string;
    ownerUserId: string;
    meetingId: string | null;
    dedupKey: string;
  }> = [];
  async enqueueCaptureAtRisk(args: {
    tenantId: string;
    recordingId: string;
    ownerUserId: string;
    meetingId: string | null;
    dedupKey: string;
  }): Promise<void> {
    this.enqueued.push(args);
  }
}

const noopLogger: RecordingWatchdogDeps['logger'] = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const makeRow = (overrides: Partial<InFlightRecording> = {}): InFlightRecording => ({
  tenantId: 'tenant-1',
  recordingId: 'rec-1',
  ownerUserId: 'user-1',
  meetingId: null,
  region: 'us',
  ...overrides,
});

describe('runRecordingWatchdog', () => {
  it('enqueues a capture-at-risk notification when heartbeat is lost', async () => {
    const reader = new FixtureReader([makeRow()]);
    const heartbeatStore = new FakeHeartbeatStore();
    const enqueuer = new FakeNotificationEnqueuer();

    const result = await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
    });

    expect(result.enqueued).toBe(1);
    expect(enqueuer.enqueued.length).toBe(1);
    expect(enqueuer.enqueued[0]?.recordingId).toBe('rec-1');
    expect(enqueuer.enqueued[0]?.dedupKey).toMatch(/^capture-at-risk:rec-1:\d+$/);
    expect(heartbeatStore.fired.has('rec-1')).toBe(true);
  });

  it('skips recordings whose heartbeat is fresh', async () => {
    const reader = new FixtureReader([makeRow()]);
    const heartbeatStore = new FakeHeartbeatStore();
    heartbeatStore.heartbeats.add('rec-1');
    const enqueuer = new FakeNotificationEnqueuer();

    const result = await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
    });

    expect(result.enqueued).toBe(0);
    expect(enqueuer.enqueued.length).toBe(0);
  });

  it('suppresses duplicate enqueues within the 5-min watchdog window', async () => {
    const reader = new FixtureReader([makeRow()]);
    const heartbeatStore = new FakeHeartbeatStore();
    heartbeatStore.fired.add('rec-1'); // simulate prior tick already fired
    const enqueuer = new FakeNotificationEnqueuer();

    const result = await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
    });

    expect(result.enqueued).toBe(0);
    expect(result.suppressed).toBe(1);
    expect(enqueuer.enqueued.length).toBe(0);
  });

  it('uses a stable dedup-bucket key derived from the clock', async () => {
    const reader = new FixtureReader([makeRow()]);
    const heartbeatStore = new FakeHeartbeatStore();
    const enqueuer = new FakeNotificationEnqueuer();
    // Pin the clock so the bucket math is deterministic.
    const fixedNow = 1_700_000_000_000;

    await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
      now: () => fixedNow,
    });

    const expectedBucket = Math.floor(fixedNow / (5 * 60 * 1000));
    expect(enqueuer.enqueued[0]?.dedupKey).toBe(`capture-at-risk:rec-1:${expectedBucket}`);
  });

  it('handles multiple rows independently', async () => {
    const reader = new FixtureReader([
      makeRow({ recordingId: 'a' }),
      makeRow({ recordingId: 'b' }),
      makeRow({ recordingId: 'c' }),
    ]);
    const heartbeatStore = new FakeHeartbeatStore();
    heartbeatStore.heartbeats.add('b'); // b is alive
    heartbeatStore.fired.add('c'); // c was already fired
    const enqueuer = new FakeNotificationEnqueuer();

    const result = await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
    });

    expect(result.scanned).toBe(3);
    expect(result.enqueued).toBe(1);
    expect(result.suppressed).toBe(1);
    expect(enqueuer.enqueued[0]?.recordingId).toBe('a');
  });

  it('passes a 24-hour-ago cutoff to the reader', async () => {
    let receivedSinceMs: number | null = null;
    const reader: RecordingWatchdogReader = {
      async listInFlight({ sinceMs }) {
        receivedSinceMs = sinceMs;
        return [];
      },
    };
    const heartbeatStore = new FakeHeartbeatStore();
    const enqueuer = new FakeNotificationEnqueuer();
    const fixedNow = 1_700_000_000_000;

    await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
      now: () => fixedNow,
    });

    expect(receivedSinceMs).toBe(fixedNow - 24 * 60 * 60 * 1000);
  });

  it('continues scanning if a single enqueue throws', async () => {
    const reader = new FixtureReader([
      makeRow({ recordingId: 'fail' }),
      makeRow({ recordingId: 'ok' }),
    ]);
    const heartbeatStore = new FakeHeartbeatStore();
    const enqueuer: WatchdogNotificationEnqueuer = {
      async enqueueCaptureAtRisk(args) {
        if (args.recordingId === 'fail') throw new Error('downstream blew up');
      },
    };

    const result = await runRecordingWatchdog({
      reader,
      heartbeatStore,
      notificationEnqueuer: enqueuer,
      logger: noopLogger,
    });

    // Both attempted; one succeeded.
    expect(result.scanned).toBe(2);
    expect(result.enqueued).toBe(1);
    expect(heartbeatStore.fired.has('ok')).toBe(true);
    expect(heartbeatStore.fired.has('fail')).toBe(false);
  });
});
