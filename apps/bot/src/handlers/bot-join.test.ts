import {
  type BotProvider,
  type BotProviderKind,
  type BotSessionStatus,
  type BotSource,
  MockBotProvider,
  type Region,
  type createBotProvider,
} from '@aisecretary/bot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryAudioSink } from '../lib/audio-sink.js';
import { InMemoryHeartbeatPublisher } from '../lib/heartbeat-publisher.js';
import {
  BOT_JOIN_QUEUE,
  type BotAuditLogInput,
  type BotJoinHandlerDeps,
  type BotSessionRow,
  type BotSessionsReadWriter,
  createBotJoinHandler,
} from './bot-join.js';

const tenantId = 'a0000000-0000-0000-0000-000000000001';
const sessionId = '11111111-2222-3333-4444-555555555555';
const ownerUserId = 'b0000000-0000-0000-0000-000000000001';

class CapturingAuditLogger {
  public readonly logs: BotAuditLogInput[] = [];
  async log(input: BotAuditLogInput): Promise<void> {
    this.logs.push(input);
  }
}

class InMemoryRepo implements BotSessionsReadWriter {
  public rows: BotSessionRow[] = [];

  async findById(id: string, tenant: string): Promise<BotSessionRow | null> {
    const r = this.rows.find((row) => row.id === id && row.tenantId === tenant);
    return r ? { ...r } : null;
  }

  async update(
    id: string,
    tenant: string,
    patch: {
      status?: BotSessionStatus;
      joinedAt?: Date | null;
      endedAt?: Date | null;
      failureReason?: string | null;
    },
  ): Promise<BotSessionRow | null> {
    const idx = this.rows.findIndex((r) => r.id === id && r.tenantId === tenant);
    if (idx === -1) return null;
    const current = this.rows[idx];
    if (!current) return null;
    const updated: BotSessionRow = {
      ...current,
      status: patch.status ?? current.status,
      joinedAt: patch.joinedAt !== undefined ? patch.joinedAt : current.joinedAt,
      endedAt: patch.endedAt !== undefined ? patch.endedAt : current.endedAt,
      failureReason:
        patch.failureReason !== undefined ? patch.failureReason : current.failureReason,
      updatedAt: new Date(),
    };
    this.rows[idx] = updated;
    return { ...updated };
  }
}

const makeRow = (overrides: Partial<BotSessionRow> = {}): BotSessionRow => ({
  id: sessionId,
  tenantId,
  meetingId: null,
  ownerUserId,
  source: 'zoom_bot' as BotSource,
  status: 'provisioning' as BotSessionStatus,
  region: 'us' as Region,
  externalMeetingId: '999-000-111',
  joinedAt: null,
  endedAt: null,
  failureReason: null,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
});

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Parameters<typeof createBotJoinHandler>[0]['logger'];

const buildDeps = (
  overrides: Partial<BotJoinHandlerDeps> = {},
): BotJoinHandlerDeps & {
  repo: InMemoryRepo;
  audit: CapturingAuditLogger;
  audioSink: InMemoryAudioSink;
  heartbeat: InMemoryHeartbeatPublisher;
} => {
  const repo = new InMemoryRepo();
  const audit = new CapturingAuditLogger();
  const audioSink = new InMemoryAudioSink();
  const heartbeat = new InMemoryHeartbeatPublisher();
  return {
    repo,
    audit,
    audioSink,
    heartbeat,
    botSessionsRepository: repo,
    heartbeatPublisher: heartbeat,
    auditLogger: audit,
    logger: silentLogger,
    mode: 'test',
    defaults: {
      displayName: 'AI Secretary Bot',
      disclosureText: 'This meeting is being recorded.',
    },
    sessionDurationMs: 5_000,
    wait: (ms, signal) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
      }),
    ...overrides,
  };
};

describe('createBotJoinHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('payload validation', () => {
    it('throws on a payload missing required fields', async () => {
      const deps = buildDeps();
      const handler = createBotJoinHandler(deps);
      await expect(handler({ data: { sessionId } as never })).rejects.toThrow(
        'bot-join: invalid payload',
      );
    });

    it('throws when the session row is missing', async () => {
      const deps = buildDeps();
      const handler = createBotJoinHandler(deps);
      await expect(handler({ data: { sessionId, tenantId, region: 'us' } })).rejects.toThrow(
        'bot-join: session not found',
      );
    });

    it('throws on region mismatch between row and payload', async () => {
      const deps = buildDeps();
      deps.repo.rows.push(makeRow({ region: 'eu' }));
      const handler = createBotJoinHandler(deps);
      await expect(handler({ data: { sessionId, tenantId, region: 'us' } })).rejects.toThrow(
        /region mismatch/,
      );
    });
  });

  describe('idempotency', () => {
    it.each<['ended' | 'failed' | 'joined']>([['ended'], ['failed'], ['joined']])(
      'no-ops when status is already %s',
      async (status) => {
        const deps = buildDeps();
        deps.repo.rows.push(makeRow({ status }));
        const handler = createBotJoinHandler(deps);
        await handler({ data: { sessionId, tenantId, region: 'us' } });
        // No audit emitted, no heartbeat started, no audio sink opened.
        expect(deps.audit.logs).toHaveLength(0);
        expect(deps.heartbeat.pulses.size).toBe(0);
        expect(deps.audioSink.opens).toHaveLength(0);
      },
    );
  });

  describe('happy path — joined → ended', () => {
    it('drives the full lifecycle and emits joined + ended audits', async () => {
      const deps = buildDeps({ sessionDurationMs: 1_000 });
      deps.repo.rows.push(makeRow());
      const handler = createBotJoinHandler(deps);

      const promise = handler({ data: { sessionId, tenantId, region: 'us' } });
      // Drain timers used by both the inner wait + MockBotProvider's audio loop.
      await vi.advanceTimersByTimeAsync(1_500);
      await promise;

      const final = deps.repo.rows[0];
      expect(final?.status).toBe('ended');
      expect(final?.joinedAt).not.toBeNull();
      expect(final?.endedAt).not.toBeNull();
      expect(final?.failureReason).toBeNull();

      const actions = deps.audit.logs.map((l) => l.action);
      expect(actions).toEqual(['bot.session.joined', 'bot.session.ended']);

      // Audio sink saw frames.
      expect(deps.audioSink.opens).toHaveLength(1);
      expect(deps.audioSink.opens[0]?.sessionId).toBe(sessionId);
      expect(deps.audioSink.frames.length).toBeGreaterThan(0);
      expect(deps.audioSink.closes).toHaveLength(1);

      // Heartbeat published at least once for the right key.
      const hbKey = `heartbeat:bot:${sessionId}`;
      expect(deps.heartbeat.pulses.get(hbKey)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(deps.heartbeat.stops).toContain(hbKey);
    });

    it('honors an external abortSignal and ends cleanly', async () => {
      const deps = buildDeps({ sessionDurationMs: 60_000 });
      deps.repo.rows.push(makeRow());
      const handler = createBotJoinHandler(deps);
      const ctrl = new AbortController();

      const promise = handler(
        { data: { sessionId, tenantId, region: 'us' } },
        { abortSignal: ctrl.signal },
      );
      await vi.advanceTimersByTimeAsync(50);
      ctrl.abort();
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(deps.repo.rows[0]?.status).toBe('ended');
    });
  });

  describe('provisioning → failed (provider rejects join)', () => {
    it('persists failed status + failureReason and emits a failed audit', async () => {
      const deps = buildDeps({
        providerConfig: { mock: { joinShouldFail: 'refused' } },
      });
      deps.repo.rows.push(makeRow());
      const handler = createBotJoinHandler(deps);

      await handler({ data: { sessionId, tenantId, region: 'us' } });

      const final = deps.repo.rows[0];
      expect(final?.status).toBe('failed');
      expect(final?.failureReason).toBe('BotJoinRefusedError');
      expect(final?.joinedAt).toBeNull();

      expect(deps.audit.logs.map((l) => l.action)).toEqual(['bot.session.failed']);
      const failedLog = deps.audit.logs[0];
      expect(failedLog?.metadata?.stage).toBe('join');

      // No audio sink opened — never reached subscribe step.
      expect(deps.audioSink.opens).toHaveLength(0);
      expect(deps.heartbeat.pulses.size).toBe(0);
    });
  });

  describe('provisioning → failed (provider construction fails)', () => {
    it('records failureReason from the construction error', async () => {
      const deps = buildDeps();
      // Force production mode + zoom source so the factory tries to
      // construct a real Zoom provider, which throws BotProviderUnavailable.
      deps.mode = 'production';
      deps.repo.rows.push(makeRow({ source: 'zoom_bot' }));
      const handler = createBotJoinHandler(deps);

      await handler({ data: { sessionId, tenantId, region: 'us' } });

      const final = deps.repo.rows[0];
      expect(final?.status).toBe('failed');
      expect(final?.failureReason).toMatch(/zoom config|provider/i);
      expect(deps.audit.logs[0]?.action).toBe('bot.session.failed');
      expect(deps.audit.logs[0]?.metadata?.stage).toBe('provider-construction');
    });
  });

  describe('queue constant', () => {
    it('exposes BOT_JOIN_QUEUE = "bot.join"', () => {
      expect(BOT_JOIN_QUEUE).toBe('bot.join');
    });
  });

  describe('provider injection', () => {
    it('lets tests inject a custom factory and selectKind', async () => {
      const deps = buildDeps();
      deps.repo.rows.push(makeRow());
      const seen: { source: BotSource; mode: string }[] = [];
      const customSelect = (input: { source: BotSource; mode: string }): BotProviderKind => {
        seen.push(input);
        return 'mock';
      };
      const customProvider: BotProvider = new MockBotProvider({ frameIntervalMs: 200 });
      const customFactory: typeof createBotProvider = () => customProvider;

      const handler = createBotJoinHandler({
        ...deps,
        selectKind: customSelect,
        providerFactory: customFactory,
        sessionDurationMs: 200,
      });
      const promise = handler({ data: { sessionId, tenantId, region: 'us' } });
      await vi.advanceTimersByTimeAsync(400);
      await promise;

      expect(seen).toEqual([{ source: 'zoom_bot', mode: 'test' }]);
      expect(deps.repo.rows[0]?.status).toBe('ended');
    });
  });
});
