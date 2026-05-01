import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { StorageProvider } from '@aisecretary/storage';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type ZoomCloudClient,
  createZoomCloudRecordingFetchHandler,
  pickBestRecording,
} from './zoom-cloud-recording-fetch.js';

const buildFakeDb = (): Db =>
  ({
    transaction: vi.fn(async (cb: (tx: { execute: () => Promise<void> }) => Promise<unknown>) =>
      cb({ execute: async () => undefined }),
    ),
  }) as unknown as Db;

const buildStorage = (): StorageProvider =>
  ({
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    delete: vi.fn(),
    initiateMultipart: vi.fn(),
    presignPart: vi.fn(),
    completeMultipart: vi.fn(),
    abortMultipart: vi.fn(),
  }) as unknown as StorageProvider;

describe('pickBestRecording', () => {
  it('prefers M4A when present', () => {
    const result = pickBestRecording([
      { id: '1', fileType: 'MP4', fileSize: 100, downloadUrl: 'a' },
      { id: '2', fileType: 'M4A', fileSize: 50, downloadUrl: 'b' },
    ]);
    expect(result?.id).toBe('2');
  });

  it('falls back to the smallest MP4 when no M4A', () => {
    const result = pickBestRecording([
      { id: '1', fileType: 'MP4', fileSize: 1000, downloadUrl: 'a' },
      { id: '2', fileType: 'MP4', fileSize: 500, downloadUrl: 'b' },
      { id: '3', fileType: 'TRANSCRIPT', fileSize: 5, downloadUrl: 'c' },
    ]);
    expect(result?.id).toBe('2');
  });

  it('returns null when the file list has nothing playable', () => {
    expect(
      pickBestRecording([
        { id: '1', fileType: 'TRANSCRIPT', fileSize: 5, downloadUrl: 'c' },
        { id: '2', fileType: 'CHAT', fileSize: 10, downloadUrl: 'd' },
      ]),
    ).toBeNull();
  });

  it('returns null on an empty list', () => {
    expect(pickBestRecording([])).toBeNull();
  });
});

describe('createZoomCloudRecordingFetchHandler', () => {
  it('rejects an invalid payload', async () => {
    const handler = createZoomCloudRecordingFetchHandler({
      db: buildFakeDb(),
      storage: buildStorage(),
      logger: pino({ level: 'silent' }),
      zoomClient: { listRecordings: async () => [] },
    });
    await expect(handler({ data: { tenantId: 'no', meetingId: 'no' } as never })).rejects.toThrow(
      /invalid payload/,
    );
  });

  it('returns null when there are no playable files', async () => {
    const zoom: ZoomCloudClient = {
      listRecordings: async () => [{ id: '1', fileType: 'CHAT', fileSize: 5, downloadUrl: 'x' }],
    };
    const handler = createZoomCloudRecordingFetchHandler({
      db: buildFakeDb(),
      storage: buildStorage(),
      logger: pino({ level: 'silent' }),
      zoomClient: zoom,
    });
    const result = await handler({
      data: {
        tenantId: randomUUID(),
        meetingId: randomUUID(),
        zoomMeetingUuid: 'zm-1',
        region: 'us',
        triggeredByUserId: randomUUID(),
      },
    });
    expect(result).toBeNull();
  });

  it('returns the storage key when a file lands', async () => {
    const zoom: ZoomCloudClient = {
      listRecordings: async () => [
        { id: '1', fileType: 'M4A', fileSize: 1024, downloadUrl: 'https://zoom/d' },
      ],
    };
    const handler = createZoomCloudRecordingFetchHandler({
      db: buildFakeDb(),
      storage: buildStorage(),
      logger: pino({ level: 'silent' }),
      zoomClient: zoom,
    });
    const tenantId = randomUUID();
    const meetingId = randomUUID();
    const result = await handler({
      data: {
        tenantId,
        meetingId,
        zoomMeetingUuid: 'zm-1',
        region: 'us',
        triggeredByUserId: randomUUID(),
      },
    });
    expect(result?.storageKey).toBe(`recordings/${tenantId}/${meetingId}.m4a`);
  });

  it('honors a custom buildStorageKey', async () => {
    const zoom: ZoomCloudClient = {
      listRecordings: async () => [
        { id: '1', fileType: 'M4A', fileSize: 1024, downloadUrl: 'https://zoom/d' },
      ],
    };
    const handler = createZoomCloudRecordingFetchHandler({
      db: buildFakeDb(),
      storage: buildStorage(),
      logger: pino({ level: 'silent' }),
      zoomClient: zoom,
      buildStorageKey: ({ meetingId }) => `custom/${meetingId}`,
    });
    const meetingId = randomUUID();
    const result = await handler({
      data: {
        tenantId: randomUUID(),
        meetingId,
        zoomMeetingUuid: 'zm-1',
        region: 'us',
        triggeredByUserId: randomUUID(),
      },
    });
    expect(result?.storageKey).toBe(`custom/${meetingId}`);
  });
});
