/**
 * Repository seam for the recordings routes (Story 2.1).
 *
 * Production wiring goes through Drizzle against the `recordings` table.
 * Tests inject an in-memory implementation that mirrors the contract —
 * this keeps the route handler testable without a live Postgres process.
 *
 * Mirrors the auth-repository pattern. The repository is the only place
 * that knows about DB row shapes; the route layer works in plain TS
 * objects.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { recordings } from '@aisecretary/db/schema';
import type { RecordingStatus } from '@aisecretary/shared';
import { and, eq } from 'drizzle-orm';

export interface RecordingRow {
  id: string;
  tenantId: string;
  meetingId: string | null;
  ownerUserId: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number | null;
  status: RecordingStatus;
  s3UploadId: string | null;
  startedAt: Date;
  uploadedAt: Date | null;
  transcribedAt: Date | null;
  failureReason: string | null;
}

export interface CreateRecordingInput {
  /** Optional caller-supplied id — when set, the repo uses it (the
   * recording id is needed to mint the storage key BEFORE the row is
   * inserted, so the route picks the id and threads it down). */
  id?: string;
  tenantId: string;
  meetingId?: string | null;
  ownerUserId: string;
  storageKey: string;
  contentType: string;
  sizeBytes?: number | null;
  s3UploadId: string;
}

export interface RecordingsRepository {
  create(input: CreateRecordingInput): Promise<RecordingRow>;
  findById(recordingId: string, tenantId: string): Promise<RecordingRow | null>;
  markUploaded(input: { recordingId: string; tenantId: string }): Promise<RecordingRow>;
  markTranscribing(input: { recordingId: string; tenantId: string }): Promise<RecordingRow>;
  markCompleted(input: { recordingId: string; tenantId: string }): Promise<RecordingRow>;
  markFailed(input: {
    recordingId: string;
    tenantId: string;
    reason: string;
  }): Promise<RecordingRow>;
}

export class DrizzleRecordingsRepository implements RecordingsRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async create(input: CreateRecordingInput): Promise<RecordingRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .insert(recordings)
          .values({
            ...(input.id !== undefined ? { id: input.id } : {}),
            tenantId: input.tenantId,
            meetingId: input.meetingId ?? null,
            ownerUserId: input.ownerUserId,
            storageKey: input.storageKey,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes ?? null,
            s3UploadId: input.s3UploadId,
            status: 'uploading',
          })
          .returning();
        const row = rows[0];
        if (!row) throw new Error('createRecording: insert returned no rows');
        return mapRow(row);
      },
    );
  }

  async findById(recordingId: string, tenantId: string): Promise<RecordingRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(recordings)
        .where(and(eq(recordings.id, recordingId), eq(recordings.tenantId, tenantId)))
        .limit(1);
      const row = rows[0];
      return row ? mapRow(row) : null;
    });
  }

  async markUploaded(input: { recordingId: string; tenantId: string }): Promise<RecordingRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .update(recordings)
          .set({ status: 'uploaded', uploadedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)))
          .returning();
        const row = rows[0];
        if (!row) throw new Error('markUploaded: row not found');
        return mapRow(row);
      },
    );
  }

  async markTranscribing(input: {
    recordingId: string;
    tenantId: string;
  }): Promise<RecordingRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .update(recordings)
          .set({ status: 'transcribing', updatedAt: new Date() })
          .where(and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)))
          .returning();
        const row = rows[0];
        if (!row) throw new Error('markTranscribing: row not found');
        return mapRow(row);
      },
    );
  }

  async markCompleted(input: { recordingId: string; tenantId: string }): Promise<RecordingRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .update(recordings)
          .set({
            status: 'completed',
            transcribedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)))
          .returning();
        const row = rows[0];
        if (!row) throw new Error('markCompleted: row not found');
        return mapRow(row);
      },
    );
  }

  async markFailed(input: {
    recordingId: string;
    tenantId: string;
    reason: string;
  }): Promise<RecordingRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .update(recordings)
          .set({
            status: 'failed',
            failureReason: input.reason,
            updatedAt: new Date(),
          })
          .where(and(eq(recordings.id, input.recordingId), eq(recordings.tenantId, input.tenantId)))
          .returning();
        const row = rows[0];
        if (!row) throw new Error('markFailed: row not found');
        return mapRow(row);
      },
    );
  }
}

const mapRow = (row: typeof recordings.$inferSelect): RecordingRow => ({
  id: row.id,
  tenantId: row.tenantId,
  meetingId: row.meetingId ?? null,
  ownerUserId: row.ownerUserId,
  storageKey: row.storageKey,
  contentType: row.contentType,
  sizeBytes: row.sizeBytes ?? null,
  status: row.status as RecordingStatus,
  s3UploadId: row.s3UploadId ?? null,
  startedAt: row.startedAt,
  uploadedAt: row.uploadedAt ?? null,
  transcribedAt: row.transcribedAt ?? null,
  failureReason: row.failureReason ?? null,
});
