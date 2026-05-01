/**
 * Presigned-URL multipart upload poster (web).
 *
 * Story 2.1 swaps the Story-4.2 mock `createFetchChunkPoster` for a real
 * three-step flow:
 *
 *   1. `initiate()`  → POST /api/v1/recordings/initiate  (auth-fetch)
 *   2. per chunk     → POST /api/v1/recordings/:id/parts/:n  (auth-fetch)
 *                       PUT  <presigned URL>  (raw fetch with chunk bytes)
 *   3. `complete()`  → POST /api/v1/recordings/:id/complete  (auth-fetch)
 *
 * The 10-min retry budget from arch-addendums § 6 (Story 4.5) wraps this
 * poster transparently — `useResumableUpload` injects the budgeted
 * `RetryPolicy` into `uploadBlobInChunks`. The poster itself is
 * stateless past `initiate`.
 *
 * Returns a `ChunkPoster` (matching the existing chunk-uploader shape)
 * along with the lifecycle hooks the controller needs:
 *
 *   const ctl = createPresignedPoster({ apiBase, authFetch });
 *   const session = await ctl.initiate({ contentType, sizeBytes });
 *   await uploadBlobInChunks({ recordingId: session.recordingId,
 *                              uploadId: session.uploadId,
 *                              poster: ctl.poster, ... });
 *   await ctl.complete(session.recordingId, parts);
 */

import type {
  CompleteUploadResponse,
  InitiateUploadResponse,
  PartUrlResponse,
} from '@aisecretary/shared';
import type { ChunkPoster } from './chunk-uploader';

export type PresignedFetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit & { skipAuth?: boolean },
) => Promise<Response>;

export interface PresignedPosterOptions {
  /** API base URL — typically `resolveApiBaseUrl()` from `lib/auth/api-client`. */
  apiBase: string;
  /** Auth-aware fetch wrapper from `useAuth().authFetch` (or a test stub). */
  authFetch: PresignedFetchLike;
  /** Raw fetch for the presigned-URL PUT — defaults to globalThis.fetch. */
  rawFetch?: typeof fetch;
}

export interface PresignedSessionInit {
  recordingId: string;
  uploadId: string;
  key: string;
}

export interface PresignedPosterController {
  /** POST /initiate — returns the recordingId + uploadId for the chunk loop. */
  initiate(input: {
    contentType: string;
    sizeBytes?: number;
    meetingId?: string;
  }): Promise<PresignedSessionInit>;
  /** Per-chunk PUT — used as `uploadBlobInChunks`'s `poster`. */
  poster: ChunkPoster;
  /** POST /complete — finalises the multipart upload. */
  complete(
    recordingId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<CompleteUploadResponse>;
  /** POST /abort — best-effort cancellation. */
  abort(recordingId: string, reason?: string): Promise<void>;
}

const buildUrl = (base: string, path: string): string => {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
};

export const createPresignedPoster = (
  options: PresignedPosterOptions,
): PresignedPosterController => {
  const rawFetch = options.rawFetch ?? globalThis.fetch.bind(globalThis);
  const url = (path: string) => buildUrl(options.apiBase, path);

  const initiate: PresignedPosterController['initiate'] = async (input) => {
    const res = await options.authFetch(url('/api/v1/recordings/initiate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`initiate failed: ${res.status}`);
    }
    const body = (await res.json()) as InitiateUploadResponse;
    return { recordingId: body.recordingId, uploadId: body.uploadId, key: body.key };
  };

  const fetchPartUrl = async (recordingId: string, partNumber: number): Promise<string> => {
    const res = await options.authFetch(
      url(`/api/v1/recordings/${recordingId}/parts/${partNumber}`),
      { method: 'POST' },
    );
    if (!res.ok) {
      throw new Error(`presign part failed: ${res.status}`);
    }
    const body = (await res.json()) as PartUrlResponse;
    return body.url;
  };

  const poster: ChunkPoster = async (envelope, signal) => {
    const presignedUrl = await fetchPartUrl(envelope.recordingId, envelope.chunkIndex + 1);
    const init: RequestInit = {
      method: 'PUT',
      headers: { 'Content-Type': envelope.mimeType },
      body: envelope.blob,
    };
    if (signal !== undefined) init.signal = signal;
    const putRes = await rawFetch(presignedUrl, init);
    if (!putRes.ok) {
      throw new Error(`chunk PUT failed: ${putRes.status}`);
    }
    // S3 returns the part's ETag in the response header.
    const rawEtag = putRes.headers.get('ETag') ?? putRes.headers.get('etag') ?? '';
    const etag = rawEtag.replaceAll('"', '');
    return {
      chunkIndex: envelope.chunkIndex,
      etag: etag.length > 0 ? etag : `presigned-${envelope.chunkIndex}`,
    };
  };

  const complete: PresignedPosterController['complete'] = async (recordingId, parts) => {
    const res = await options.authFetch(url(`/api/v1/recordings/${recordingId}/complete`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts }),
    });
    if (!res.ok) {
      throw new Error(`complete failed: ${res.status}`);
    }
    return (await res.json()) as CompleteUploadResponse;
  };

  const abort: PresignedPosterController['abort'] = async (recordingId, reason) => {
    await options.authFetch(url(`/api/v1/recordings/${recordingId}/abort`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? 'cancelled' }),
    });
  };

  return { initiate, poster, complete, abort };
};
