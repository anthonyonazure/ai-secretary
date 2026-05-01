import { z } from 'zod';

/**
 * Wire contract for the recordings API surface (Story 2.1).
 *
 * apps/api implements:
 *   - POST   /api/v1/recordings/initiate
 *   - POST   /api/v1/recordings/:recordingId/parts/:partNumber
 *   - POST   /api/v1/recordings/:recordingId/complete
 *   - POST   /api/v1/recordings/:recordingId/abort
 *   - GET    /api/v1/recordings/:recordingId
 *
 * apps/web + apps/mobile consume them via `presigned-poster.ts`.
 */

export const recordingStatusSchema = z.enum([
  'uploading',
  'uploaded',
  'transcribing',
  'completed',
  'failed',
]);
export type RecordingStatus = z.infer<typeof recordingStatusSchema>;

export const initiateUploadRequestSchema = z.object({
  /** Optional meeting binding. Recordings without a meetingId still upload. */
  meetingId: z.string().uuid().optional(),
  contentType: z.string().min(1).max(120),
  /** Total content length in bytes; informational. */
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type InitiateUploadRequest = z.infer<typeof initiateUploadRequestSchema>;

export const initiateUploadResponseSchema = z.object({
  recordingId: z.string().uuid(),
  uploadId: z.string().min(1),
  /** Provider-agnostic storage key — caller does not need to interpret. */
  key: z.string().min(1),
});
export type InitiateUploadResponse = z.infer<typeof initiateUploadResponseSchema>;

export const partUrlResponseSchema = z.object({
  partNumber: z.number().int().positive(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type PartUrlResponse = z.infer<typeof partUrlResponseSchema>;

export const multipartPartSchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
});
export type MultipartPart = z.infer<typeof multipartPartSchema>;

export const completeUploadRequestSchema = z.object({
  parts: z.array(multipartPartSchema).min(1),
});
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

export const completeUploadResponseSchema = z.object({
  recordingId: z.string().uuid(),
  status: recordingStatusSchema,
  /** Job-queue id for the enqueued transcribe job. */
  transcribeJobId: z.string().min(1).nullable(),
});
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;

export const abortUploadResponseSchema = z.object({
  recordingId: z.string().uuid(),
  status: recordingStatusSchema,
});
export type AbortUploadResponse = z.infer<typeof abortUploadResponseSchema>;

export const recordingResponseSchema = z.object({
  recordingId: z.string().uuid(),
  meetingId: z.string().uuid().nullable(),
  status: recordingStatusSchema,
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  storageKey: z.string(),
  startedAt: z.string().datetime(),
  uploadedAt: z.string().datetime().nullable(),
  transcribedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
});
export type RecordingResponse = z.infer<typeof recordingResponseSchema>;

/**
 * Presigned-GET playback URL response shape — Story 2.1 follow-up.
 *
 * Returned by:
 *   - `GET /api/v1/recordings/:recordingId/play` — direct presign by id
 *   - `GET /api/v1/meetings/:meetingId/playback-url` — meeting-scoped resolver
 *
 * Clients render the URL into an `<audio>` element (web) or expo-audio
 * source (mobile). `expiresAt` lets clients schedule a refresh just before
 * the URL goes stale (default expiry is 15 minutes — see
 * `packages/storage/src/types.ts`).
 */
export const recordingPlaybackResponseSchema = z.object({
  recordingId: z.string().uuid(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  contentType: z.string(),
});
export type RecordingPlaybackResponse = z.infer<typeof recordingPlaybackResponseSchema>;
