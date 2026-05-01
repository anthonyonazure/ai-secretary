/**
 * Presigned-URL multipart upload poster (mobile).
 *
 * Mirrors apps/web/src/lib/recording/presigned-poster.ts but adapts to
 * the mobile chunk source: chunks arrive as base64-encoded strings
 * (from `expo-file-system.readAsStringAsync`), so the per-chunk PUT
 * decodes via `fetch(..., { body: base64ToArrayBuffer(...) })`.
 *
 * Same three-step shape:
 *   1. initiate → POST /api/v1/recordings/initiate
 *   2. part      → POST /api/v1/recordings/:id/parts/:n   (auth-fetch)
 *                  PUT  <presigned URL>                   (raw fetch + bytes)
 *   3. complete  → POST /api/v1/recordings/:id/complete
 */

import type {
  CompleteUploadResponse,
  InitiateUploadResponse,
  PartUrlResponse,
} from '@aisecretary/shared';
import type { ChunkPoster } from './chunk-uploader';

export type PresignedFetchLike = (
  input: string,
  init?: RequestInit & { skipAuth?: boolean },
) => Promise<Response>;

export interface PresignedPosterOptions {
  apiBase: string;
  authFetch: PresignedFetchLike;
  rawFetch?: typeof fetch;
}

export interface PresignedSessionInit {
  recordingId: string;
  uploadId: string;
  key: string;
}

export interface PresignedPosterController {
  initiate(input: {
    contentType: string;
    sizeBytes?: number;
    meetingId?: string;
  }): Promise<PresignedSessionInit>;
  poster: ChunkPoster;
  complete(
    recordingId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<CompleteUploadResponse>;
  abort(recordingId: string, reason?: string): Promise<void>;
}

const buildUrl = (base: string, path: string): string => {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
};

const base64ToArrayBuffer = (b64: string): ArrayBuffer => {
  // RN polyfills `atob`; node test envs may not. Both paths work the
  // same way: decode base64 → byte array → ArrayBuffer.
  const binary =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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

  const poster: ChunkPoster = async (envelope) => {
    const presignedUrl = await fetchPartUrl(envelope.recordingId, envelope.chunkIndex + 1);
    const bytes = base64ToArrayBuffer(envelope.base64);
    const putRes = await rawFetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': envelope.mimeType },
      body: bytes,
    });
    if (!putRes.ok) {
      throw new Error(`chunk PUT failed: ${putRes.status}`);
    }
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
