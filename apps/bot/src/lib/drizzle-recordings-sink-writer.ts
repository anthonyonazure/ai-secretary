/**
 * Drizzle-backed `RecordingsSinkWriter` — production impl of the
 * structural slice the `RecordingsChunkUploadAudioSink` needs.
 *
 * Mirrors the create + status-transition slice of
 * `apps/api/src/routes/recordings-repository.ts`. Re-implemented here
 * to keep `apps/bot` independent from `apps/api`; both consume
 * `packages/db` directly.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { recordings } from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';

import type { RecordingsSinkWriter } from './recordings-chunk-upload-audio-sink.js';

export class DrizzleRecordingsSinkWriter implements RecordingsSinkWriter {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async create(input: {
    id?: string;
    tenantId: string;
    meetingId?: string | null;
    ownerUserId: string;
    storageKey: string;
    contentType: string;
    sizeBytes?: number | null;
    s3UploadId: string;
  }): Promise<{ id: string; tenantId: string }> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const [row] = await tx
          .insert(recordings)
          .values({
            ...(input.id ? { id: input.id } : {}),
            tenantId: input.tenantId,
            meetingId: input.meetingId ?? null,
            ownerUserId: input.ownerUserId,
            storageKey: input.storageKey,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes ?? null,
            status: 'uploading',
            s3UploadId: input.s3UploadId,
          })
          .returning({ id: recordings.id, tenantId: recordings.tenantId });
        if (!row) throw new Error('recordings.create returned no row');
        return row;
      },
    );
  }

  async markUploaded(input: { recordingId: string; tenantId: string }): Promise<unknown> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        await tx
          .update(recordings)
          .set({
            status: 'uploaded',
            uploadedAt: new Date(),
            updatedAt: new Date(),
            s3UploadId: null,
          })
          .where(
            and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)),
          );
        return undefined;
      },
    );
  }

  async markFailed(input: {
    recordingId: string;
    tenantId: string;
    reason: string;
  }): Promise<unknown> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        await tx
          .update(recordings)
          .set({
            status: 'failed',
            failureReason: input.reason.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(
            and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)),
          );
        return undefined;
      },
    );
  }
}
