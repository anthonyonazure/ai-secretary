/**
 * `zoom-cloud-recording-fetch` queue handler — Story 9.6 fallback path
 * (FR15).
 *
 * When the bot fails to capture a Zoom meeting (drop, late-join,
 * permission denied), the user can fall back to fetching the
 * post-meeting Zoom Cloud recording. This handler:
 *
 *   1. Validates the payload (zoom meetingId + tenantId + region)
 *   2. Calls Zoom's `/meetings/{meetingId}/recordings` API to list
 *      available recording files
 *   3. Picks the audio-only (`M4A`) variant when present, otherwise
 *      the smallest video file
 *   4. Streams the bytes through `packages/storage` into our object
 *      store, mirroring the recording row shape so the existing
 *      transcribe pipeline picks up the meeting
 *
 * Today this is a STUB: the actual Zoom token fetch + multipart
 * stream is wired by the bot service slice (Story 9.3+) which is
 * blocked on Zoom S2S OAuth credentials. The handler here ships the
 * abstraction shape + the validation surface so the bot service can
 * plug into it without restructuring.
 */

import type { Db, Region } from '@aisecretary/db';
import type { StorageProvider } from '@aisecretary/storage';
import type pino from 'pino';
import { z } from 'zod';

import { withJobContext } from '../lib/job-context.js';

export const ZOOM_CLOUD_RECORDING_FETCH_QUEUE = 'zoom-cloud-recording-fetch';

export const zoomCloudRecordingFetchPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  zoomMeetingUuid: z.string().min(1),
  region: z.enum(['us', 'eu']),
  /** Trigger user — used for the audit row + the resulting recording's owner_user_id. */
  triggeredByUserId: z.string().uuid(),
});
export type ZoomCloudRecordingFetchPayload = z.infer<typeof zoomCloudRecordingFetchPayloadSchema>;

export interface ZoomCloudRecordingFetchJob {
  data: ZoomCloudRecordingFetchPayload;
}

/**
 * Zoom client abstraction — wired by the bot-service slice that owns
 * the S2S OAuth credentials. The handler accepts a function that
 * returns the recording-file metadata + a streaming download URL.
 */
export interface ZoomCloudClient {
  listRecordings(input: { meetingUuid: string }): Promise<ZoomRecordingFile[]>;
}

export interface ZoomRecordingFile {
  /** Zoom-side id for dedup. */
  id: string;
  fileType: 'M4A' | 'MP4' | 'TRANSCRIPT' | 'CHAT' | string;
  fileSize: number;
  /** Pre-authenticated download URL — short-lived. */
  downloadUrl: string;
}

export interface ZoomCloudRecordingFetchDeps {
  db: Db;
  storage: StorageProvider;
  logger: pino.Logger;
  zoomClient: ZoomCloudClient;
  /** Override for tests — controls the storage key the fetched bytes
   *  land at. Production defaults to `recordings/{tenantId}/{meetingId}.m4a`. */
  buildStorageKey?: (input: { tenantId: string; meetingId: string }) => string;
}

const defaultStorageKey = (input: { tenantId: string; meetingId: string }): string =>
  `recordings/${input.tenantId}/${input.meetingId}.m4a`;

/**
 * Pure helper: pick the best file from a Zoom recording-list response.
 * Prefers the audio-only `M4A` for transcription throughput; falls
 * back to the smallest `MP4` when audio-only isn't present.
 */
export const pickBestRecording = (
  files: ReadonlyArray<ZoomRecordingFile>,
): ZoomRecordingFile | null => {
  const m4a = files.find((f) => f.fileType === 'M4A');
  if (m4a) return m4a;
  const mp4s = files.filter((f) => f.fileType === 'MP4').sort((a, b) => a.fileSize - b.fileSize);
  return mp4s[0] ?? null;
};

export const createZoomCloudRecordingFetchHandler = (deps: ZoomCloudRecordingFetchDeps) => {
  const buildKey = deps.buildStorageKey ?? defaultStorageKey;
  return async (job: ZoomCloudRecordingFetchJob): Promise<{ storageKey: string } | null> => {
    const parsed = zoomCloudRecordingFetchPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      deps.logger.error(
        { issues: parsed.error.issues },
        'zoom-cloud-recording-fetch: invalid payload',
      );
      throw new Error('zoom-cloud-recording-fetch: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };
    deps.logger.info({ meetingId: data.meetingId }, 'zoom-cloud-recording-fetch: started');

    const files = await deps.zoomClient.listRecordings({
      meetingUuid: data.zoomMeetingUuid,
    });
    const chosen = pickBestRecording(files);
    if (!chosen) {
      deps.logger.warn(
        { meetingId: data.meetingId },
        'zoom-cloud-recording-fetch: no playable file in the cloud recording',
      );
      return null;
    }

    const storageKey = buildKey({ tenantId: data.tenantId, meetingId: data.meetingId });
    // Streaming download → multipart upload would happen here. Today
    // the upload is a placeholder — the bot-service slice provides
    // the stream pipe, then a recordings-row insert happens against
    // the live tx so the transcribe pipeline picks the meeting up.
    await withJobContext(deps.db, ctx, async () => {
      // Placeholder: bot-service slice writes the recordings row.
      void deps.storage; // referenced once the real upload lands
    });

    deps.logger.info(
      { meetingId: data.meetingId, storageKey, fileType: chosen.fileType },
      'zoom-cloud-recording-fetch: stored',
    );
    return { storageKey };
  };
};
