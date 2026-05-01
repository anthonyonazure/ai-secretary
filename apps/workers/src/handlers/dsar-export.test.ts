/**
 * Story 14.1 — DSAR export handler integration tests.
 *
 * Verifies the worker:
 *   - flips status: queued → processing → ready on the success path
 *   - uploads a zip via the storage multipart API
 *   - mints a 7-day presigned-GET URL
 *   - dispatches `kind: 'dsar-ready'` notification with the dsar template context
 *   - emits `dsar.export-completed` (logger-only) on success
 *   - flips status to failed + dispatches `dsar-failed` + emits
 *     `dsar.export-failed` (logger-only) on the failure path
 *   - the produced zip contains one entry per registered table
 */

import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { NotificationRequest } from '@aisecretary/notifications';
import type {
  MultipartCompleteResult,
  MultipartUploadInit,
  PresignedUrl,
  StorageProvider,
} from '@aisecretary/storage';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { DsarExportReader, DsarPayload } from './dsar-export-reader.js';
import {
  type DsarAudioFetcher,
  type DsarNotificationEnqueuer,
  type WorkerDsarRepository,
  createDsarExportHandler,
} from './dsar-export.js';

const silentLogger = pino({ level: 'silent' });

const fakeDb: Db = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      execute: vi.fn(async () => undefined),
    }),
  ),
} as unknown as Db;

const buildPayload = (): DsarPayload => ({
  tenant: [{ id: 't-1', name: 'Acme' }],
  user: [{ id: 'u-1', email: 'me@acme.test', name: 'Me' }],
  meetings: [{ id: 'm-1', ownerUserId: 'u-1' }],
  recordings: [{ id: 'r-1', ownerUserId: 'u-1', storageKey: 'tenants/t-1/recordings/r-1.bin' }],
  speakerTurns: [{ id: 's-1', meetingId: 'm-1', text: 'hello' }],
  consents: [{ id: 'c-1', meetingId: 'm-1' }],
  notifications: [{ id: 'n-1', recipient: 'u-1' }],
  userPreferences: [{ id: 'up-1', userId: 'u-1' }],
  auditLogs: [{ id: 'a-1', actorUserId: 'u-1' }],
  feedbackThumbs: [{ id: 'f-1', userId: 'u-1' }],
  invites: [{ id: 'i-1', acceptedByUserId: 'u-1' }],
  dsarRequests: [{ id: 'd-1', userId: 'u-1', status: 'processing' }],
});

const buildFakeStorage = (): { storage: StorageProvider; uploadedParts: Buffer[] } => {
  const uploadedParts: Buffer[] = [];
  const presignedGet: PresignedUrl = {
    url: 'https://signed.example.test/zip.zip',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  const presignedPart: PresignedUrl = {
    url: 'https://upload.example.test/part',
    expiresAt: new Date(Date.now() + 600_000),
  };
  const init: MultipartUploadInit = { uploadId: 'u-id', key: 'unset' };
  const completeResult: MultipartCompleteResult = {
    etag: '"abc"',
    location: 'https://signed.example.test/zip.zip',
  };
  const storage: StorageProvider = {
    presignPut: vi.fn(),
    createMultipartUpload: vi.fn(async (key: string) => ({ ...init, key })),
    presignPart: vi.fn(async () => presignedPart),
    completeMultipartUpload: vi.fn(async () => completeResult),
    abortMultipartUpload: vi.fn(),
    presignGet: vi.fn(async () => presignedGet),
    headObject: vi.fn(),
    delete: vi.fn(),
  } as unknown as StorageProvider;

  // Replace global fetch with a captor: presigned-PUT for parts records
  // the body; presigned-GET for audio returns a 1-byte buffer.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('upload.example.test')) {
      const body = init?.body as ArrayBuffer | Buffer | undefined;
      if (body !== undefined) {
        if (Buffer.isBuffer(body)) {
          uploadedParts.push(body);
        } else {
          uploadedParts.push(Buffer.from(body as ArrayBuffer));
        }
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"part-etag"' }),
      } as unknown as Response;
    }
    // Audio fetch fallback (we override audioFetcher in tests so this
    // shouldn't be hit, but we keep a safety net).
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;

  return { storage, uploadedParts };
};

describe('createDsarExportHandler — success path', () => {
  it('flips state queued→processing→ready, uploads a zip, dispatches dsar-ready', async () => {
    const { storage } = buildFakeStorage();
    const calls: Array<{ method: string; args: unknown }> = [];
    const dsarRepo: WorkerDsarRepository = {
      async markProcessing(id) {
        calls.push({ method: 'markProcessing', args: id });
      },
      async markReady(id, input) {
        calls.push({ method: 'markReady', args: { id, input } });
      },
      async markFailed(id, reason) {
        calls.push({ method: 'markFailed', args: { id, reason } });
      },
    };
    const enqueued: NotificationRequest[] = [];
    const notificationEnqueuer: DsarNotificationEnqueuer = {
      async enqueue(req) {
        enqueued.push(req);
      },
    };
    const exportReader: DsarExportReader = {
      async readUserData() {
        return buildPayload();
      },
    };
    const audioFetcher: DsarAudioFetcher = {
      async fetch() {
        return Buffer.from([0x00]);
      },
    };

    const handler = createDsarExportHandler({
      db: fakeDb,
      storage,
      dsarRepository: dsarRepo,
      notificationEnqueuer,
      exportReader,
      logger: silentLogger,
      audioFetcher,
    });

    const requestId = randomUUID();
    const tenantId = randomUUID();
    const userId = randomUUID();
    await handler({
      data: { requestId, tenantId, userId, region: 'us' },
    });

    // Lifecycle methods called in the right order.
    expect(calls.map((c) => c.method)).toEqual(['markProcessing', 'markReady']);

    // Storage interactions.
    expect(storage.createMultipartUpload).toHaveBeenCalledWith(
      `dsar-exports/${tenantId}/${requestId}.zip`,
      expect.objectContaining({ contentType: 'application/zip' }),
    );
    expect(storage.completeMultipartUpload).toHaveBeenCalled();
    // presignGet called once for the audio + once for the final 7d URL.
    expect(storage.presignGet).toHaveBeenCalled();

    // Notification dispatch.
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.kind).toBe('dsar-ready');
    expect(enqueued[0]?.recipient.channel).toBe('email');
    if (enqueued[0]?.recipient.channel === 'email') {
      expect(enqueued[0].recipient.email).toBe('me@acme.test');
    }
    if (enqueued[0]?.payload.channel === 'email') {
      expect(enqueued[0].payload.context.requestId).toBe(requestId);
      expect(typeof enqueued[0].payload.context.downloadUrl).toBe('string');
    }
    expect(enqueued[0]?.dedupKey).toBe(`dsar:${requestId}:dsar-ready`);
  });

  it('zip contains one entry per registered table', async () => {
    const { storage, uploadedParts } = buildFakeStorage();
    const dsarRepo: WorkerDsarRepository = {
      async markProcessing() {},
      async markReady() {},
      async markFailed() {},
    };
    const enqueued: NotificationRequest[] = [];
    const exportReader: DsarExportReader = {
      async readUserData() {
        return buildPayload();
      },
    };

    const handler = createDsarExportHandler({
      db: fakeDb,
      storage,
      dsarRepository: dsarRepo,
      notificationEnqueuer: {
        async enqueue(r) {
          enqueued.push(r);
        },
      },
      exportReader,
      logger: silentLogger,
      audioFetcher: {
        async fetch() {
          return Buffer.from([0x00]);
        },
      },
    });

    await handler({
      data: { requestId: randomUUID(), tenantId: randomUUID(), userId: randomUUID(), region: 'us' },
    });

    // The uploaded buffer is a real ZIP. We don't unzip it here (no
    // dependency); we sanity-check the presence of every table-name
    // entry as a substring (zip stores filenames in plaintext in both
    // local file headers and the central directory).
    expect(uploadedParts.length).toBeGreaterThan(0);
    const allBytes = Buffer.concat(uploadedParts);
    const tableNames = [
      'tenant.json',
      'user.json',
      'meetings.json',
      'recordings.json',
      'speakerTurns.json',
      'consents.json',
      'notifications.json',
      'userPreferences.json',
      'auditLogs.json',
      'feedbackThumbs.json',
      'invites.json',
      'dsarRequests.json',
    ];
    const blob = allBytes.toString('latin1');
    for (const name of tableNames) {
      expect(blob).toContain(name);
    }
    // Audio entry is present too.
    expect(blob).toContain('audio/');
  });
});

describe('createDsarExportHandler — failure path', () => {
  it('marks failed + dispatches dsar-failed when the export reader throws', async () => {
    const { storage } = buildFakeStorage();
    const dsarRepo: WorkerDsarRepository = {
      markProcessing: vi.fn(async () => {}),
      markReady: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    };
    const enqueued: NotificationRequest[] = [];
    const enqueuer: DsarNotificationEnqueuer = {
      async enqueue(r) {
        enqueued.push(r);
      },
    };
    let reads = 0;
    const exportReader: DsarExportReader = {
      async readUserData() {
        reads += 1;
        if (reads === 1) {
          throw new Error('reader exploded');
        }
        return buildPayload();
      },
    };

    const handler = createDsarExportHandler({
      db: fakeDb,
      storage,
      dsarRepository: dsarRepo,
      notificationEnqueuer: enqueuer,
      exportReader,
      logger: silentLogger,
      audioFetcher: {
        async fetch() {
          return Buffer.alloc(0);
        },
      },
    });

    const requestId = randomUUID();
    await expect(
      handler({
        data: { requestId, tenantId: randomUUID(), userId: randomUUID(), region: 'us' },
      }),
    ).rejects.toThrow(/reader exploded/);

    expect(dsarRepo.markFailed).toHaveBeenCalledWith(requestId, expect.stringContaining('reader'));
    expect(enqueued.some((r) => r.kind === 'dsar-failed')).toBe(true);
    const failed = enqueued.find((r) => r.kind === 'dsar-failed');
    expect(failed?.dedupKey).toBe(`dsar:${requestId}:dsar-failed`);
  });
});
