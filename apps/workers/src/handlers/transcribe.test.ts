import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { PresignedUrl, StorageProvider } from '@aisecretary/storage';
import {
  MockTranscriptionProvider,
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
} from '@aisecretary/transcription';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createTranscribeHandler } from './transcribe.js';

/**
 * Build a fake Db handle that captures the sequence of `update().set()`,
 * `select().from()`, and `insert()` calls without touching Postgres.
 *
 * `withTenantContext` (called inside `withJobContext`) goes through
 * `db.transaction(...)` and runs `set_config` SQL statements first; the
 * fake's transaction implementation just runs the inner callback with
 * the same fake handle so update calls bubble up.
 */
const buildFakeDb = (overrides: {
  recording?: {
    id: string;
    status: string;
    tenantId: string;
    meetingId: string | null;
    storageKey: string;
    contentType: string;
  } | null;
  tenant?: {
    region: 'us' | 'eu';
    compliancePosture: {
      hipaa?: boolean;
      bookGdpr?: boolean;
      customManagedKeys?: boolean;
    };
  } | null;
}) => {
  const sets: Array<Record<string, unknown>> = [];
  const inserts: Array<Array<Record<string, unknown>>> = [];
  /**
   * `select` is called twice in the success path: once for the
   * recording, once for the tenant. We answer in that order.
   */
  let selectCallIndex = 0;

  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            const index = selectCallIndex;
            selectCallIndex += 1;
            if (index === 0) {
              return overrides.recording !== undefined && overrides.recording !== null
                ? [overrides.recording]
                : [];
            }
            return overrides.tenant !== undefined && overrides.tenant !== null
              ? [overrides.tenant]
              : [];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        sets.push(values);
        return {
          where: vi.fn(async () => []),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        inserts.push(rows);
        return [];
      }),
    })),
  };

  const fakeDb = {
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => {
      return cb(txStub);
    }),
  } as unknown as Db;

  return { fakeDb, sets, inserts, txStub };
};

const buildFakeStorage = (): StorageProvider => {
  const presigned: PresignedUrl = {
    url: 'https://signed.example.com/audio.webm',
    expiresAt: new Date(Date.now() + 600_000),
  };
  return {
    presignPut: vi.fn(),
    createMultipartUpload: vi.fn(),
    presignPart: vi.fn(),
    completeMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn(),
    presignGet: vi.fn(async () => presigned),
    headObject: vi.fn(),
    delete: vi.fn(),
  } as unknown as StorageProvider;
};

const silentLogger = pino({ level: 'silent' });

const makePayload = (overrides: { tenantId?: string; recordingId?: string } = {}) => ({
  recordingId: overrides.recordingId ?? randomUUID(),
  tenantId: overrides.tenantId ?? randomUUID(),
  region: 'us' as const,
});

describe('createTranscribeHandler (Story 2.2)', () => {
  it('rejects an invalid payload', async () => {
    const { fakeDb } = buildFakeDb({});
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory: vi.fn(),
      env: {},
    });
    await expect(handler({ data: { recordingId: 'not-uuid' } as never })).rejects.toThrow(
      /transcribe: invalid payload/,
    );
  });

  it('runs full pipeline: read → transcribing → presign → mock → speaker_turns → completed', async () => {
    const payload = makePayload();
    const meetingId = randomUUID();
    const { fakeDb, sets, inserts } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'uploaded',
        tenantId: payload.tenantId,
        meetingId,
        storageKey: `tenants/${payload.tenantId}/recordings/${payload.recordingId}.bin`,
        contentType: 'audio/webm',
      },
      tenant: {
        region: 'us',
        compliancePosture: {},
      },
    });
    const storage = buildFakeStorage();
    const mockProvider = MockTranscriptionProvider.fromText(
      'Hello world this is a meeting.',
      30_000,
    );
    const transcriptionFactory = vi.fn(() => mockProvider as unknown as TranscriptionProvider);

    const handler = createTranscribeHandler({
      db: fakeDb,
      storage,
      logger: silentLogger,
      transcriptionFactory,
      env: { OPENAI_API_KEY: 'sk-test' },
    });
    await handler({ data: payload });

    // Status transitions: first set is `transcribing`, second is `completed`.
    expect(sets.length).toBe(2);
    expect(sets[0]?.status).toBe('transcribing');
    expect(sets[1]?.status).toBe('completed');
    expect(sets[1]?.transcribedAt).toBeInstanceOf(Date);

    // Provider was built with whisper-api kind (US non-HIPAA, posture empty).
    expect(transcriptionFactory).toHaveBeenCalledTimes(1);
    expect(transcriptionFactory.mock.calls[0]?.[0]?.kind).toBe('whisper-api');

    // Presign-GET was called against the storage key.
    expect(storage.presignGet).toHaveBeenCalledTimes(1);

    // Speaker_turns rows inserted; every row has speaker:null + a stable
    // 16-hex turnId.
    expect(inserts.length).toBe(1);
    const turnRows = inserts[0] ?? [];
    expect(turnRows.length).toBeGreaterThan(0);
    for (const row of turnRows) {
      expect(row.speaker).toBeNull();
      expect(row.tenantId).toBe(payload.tenantId);
      expect(row.meetingId).toBe(meetingId);
      expect(typeof row.turnId).toBe('string');
      expect((row.turnId as string).length).toBe(16);
    }
    // Sequence numbers are 0..N-1.
    expect(turnRows.map((r) => r.sequence)).toEqual(
      Array.from({ length: turnRows.length }, (_, i) => i),
    );
  });

  it('routes HIPAA tenants to faster-whisper', async () => {
    const payload = makePayload();
    const { fakeDb } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'uploaded',
        tenantId: payload.tenantId,
        meetingId: randomUUID(),
        storageKey: 'k',
        contentType: 'audio/webm',
      },
      tenant: {
        region: 'us',
        compliancePosture: { hipaa: true },
      },
    });
    const transcriptionFactory = vi.fn(
      () => MockTranscriptionProvider.fromText('x', 5_000) as unknown as TranscriptionProvider,
    );
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory,
      env: { FASTER_WHISPER_URL: 'http://fw.local:8000' },
    });
    await handler({ data: payload });
    expect(transcriptionFactory).toHaveBeenCalledTimes(1);
    expect(transcriptionFactory.mock.calls[0]?.[0]?.kind).toBe('faster-whisper');
  });

  it('falls back to MockTranscriptionProvider when env is unset (no factory call)', async () => {
    const payload = makePayload();
    const { fakeDb, inserts } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'uploaded',
        tenantId: payload.tenantId,
        meetingId: randomUUID(),
        storageKey: 'k',
        contentType: 'audio/webm',
      },
      tenant: { region: 'us', compliancePosture: {} },
    });
    const transcriptionFactory = vi.fn();
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory,
      env: {},
    });
    await handler({ data: payload });
    // No real provider built — fell back to mock.
    expect(transcriptionFactory).not.toHaveBeenCalled();
    // But we still got speaker_turns from the mock.
    expect(inserts.length).toBe(1);
    expect((inserts[0] ?? []).length).toBeGreaterThan(0);
  });

  it('skips when recording is already transcribing (idempotent re-fire)', async () => {
    const payload = makePayload();
    const { fakeDb, sets, inserts } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'transcribing',
        tenantId: payload.tenantId,
        meetingId: randomUUID(),
        storageKey: 'k',
        contentType: 'audio/webm',
      },
      tenant: { region: 'us', compliancePosture: {} },
    });
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory: vi.fn(),
      env: {},
    });
    await handler({ data: payload });
    expect(sets.length).toBe(0);
    expect(inserts.length).toBe(0);
  });

  it('marks failed when the provider throws', async () => {
    const payload = makePayload();
    const { fakeDb, sets } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'uploaded',
        tenantId: payload.tenantId,
        meetingId: randomUUID(),
        storageKey: 'k',
        contentType: 'audio/webm',
      },
      tenant: { region: 'us', compliancePosture: {} },
    });
    const failing: TranscriptionProvider = {
      kind: 'mock',
      transcribe: async (_input: TranscriptionRequest): Promise<TranscriptionResult> => {
        throw new TranscriptionError('engine exploded');
      },
    };
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory: () => failing,
      env: { OPENAI_API_KEY: 'sk-test' },
    });
    await expect(handler({ data: payload })).rejects.toBeInstanceOf(TranscriptionError);
    // First set: transcribing. Last set: failed with reason.
    expect(sets[0]?.status).toBe('transcribing');
    const last = sets[sets.length - 1];
    expect(last?.status).toBe('failed');
    expect(last?.failureReason).toContain('engine exploded');
  });

  it('throws (and marks failed) when meetingId is null', async () => {
    const payload = makePayload();
    const { fakeDb, sets } = buildFakeDb({
      recording: {
        id: payload.recordingId,
        status: 'uploaded',
        tenantId: payload.tenantId,
        meetingId: null,
        storageKey: 'k',
        contentType: 'audio/webm',
      },
      tenant: { region: 'us', compliancePosture: {} },
    });
    const handler = createTranscribeHandler({
      db: fakeDb,
      storage: buildFakeStorage(),
      logger: silentLogger,
      transcriptionFactory: vi.fn(),
      env: {},
    });
    await expect(handler({ data: payload })).rejects.toThrow(/no associated meetingId/);
    const last = sets[sets.length - 1];
    expect(last?.status).toBe('failed');
  });
});
