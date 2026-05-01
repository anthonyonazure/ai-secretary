/**
 * Multipart upload primitive used by both the live (mid-recording chunk
 * flush) and the post-stop (full-blob) upload paths. Pure logic; the HTTP
 * call is injected so tests can mock without touching `fetch`.
 *
 * The retry policy is exposed as a parameter so Story 4.5 can plug in the
 * 10-min budget + jittered backoff curve from arch-addendums § 6 without
 * modifying this primitive. Default policy here is a minimal 3-attempt
 * exponential — enough for E2E sanity but deliberately conservative.
 */

export interface ChunkRange {
  index: number;
  start: number;
  end: number; // exclusive
}

export interface UploadEnvelope {
  recordingId: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  mimeType: string;
  blob: Blob;
}

export interface ChunkUploadResult {
  chunkIndex: number;
  etag: string;
}

export type ChunkPoster = (
  envelope: UploadEnvelope,
  signal?: AbortSignal,
) => Promise<ChunkUploadResult>;

export interface RetryPolicy {
  maxAttempts: number;
  /** Returns the wait time in ms before attempt N (0-indexed). */
  backoffMs: (attempt: number) => number;
  /** Optional sleep injection — defaults to setTimeout. Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: (attempt) => Math.min(2 ** attempt * 500, 5_000),
};

export const DEFAULT_CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB — S3 multipart minimum

export function planChunks(totalSize: number, chunkSize = DEFAULT_CHUNK_SIZE_BYTES): ChunkRange[] {
  if (totalSize <= 0) return [];
  const ranges: ChunkRange[] = [];
  let offset = 0;
  let index = 0;
  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    ranges.push({ index, start: offset, end });
    offset = end;
    index += 1;
  }
  return ranges;
}

export interface UploadAllParams {
  recordingId: string;
  uploadId: string;
  blob: Blob;
  mimeType: string;
  chunkSize?: number;
  poster: ChunkPoster;
  retry?: RetryPolicy;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

/**
 * Uploads `blob` as a sequence of chunks via the injected `poster`. Honors
 * `AbortSignal`; emits monotonic progress on each successful chunk. The
 * retry policy applies per-chunk; when exhausted the chunk's last error
 * propagates and the overall upload rejects (Story 4.5 wraps this with the
 * 10-min outer budget).
 */
export async function uploadBlobInChunks(params: UploadAllParams): Promise<ChunkUploadResult[]> {
  const {
    recordingId,
    uploadId,
    blob,
    mimeType,
    chunkSize = DEFAULT_CHUNK_SIZE_BYTES,
    poster,
    retry = DEFAULT_RETRY_POLICY,
    signal,
    onProgress,
  } = params;

  const ranges = planChunks(blob.size, chunkSize);
  if (ranges.length === 0) {
    onProgress?.(1);
    return [];
  }

  const results: ChunkUploadResult[] = [];
  for (const range of ranges) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    const slice = blob.slice(range.start, range.end, mimeType);
    const result = await postWithRetry(
      {
        recordingId,
        uploadId,
        chunkIndex: range.index,
        totalChunks: ranges.length,
        mimeType,
        blob: slice,
      },
      poster,
      retry,
      signal,
    );
    results.push(result);
    onProgress?.((range.index + 1) / ranges.length);
  }
  return results;
}

async function postWithRetry(
  envelope: UploadEnvelope,
  poster: ChunkPoster,
  retry: RetryPolicy,
  signal: AbortSignal | undefined,
): Promise<ChunkUploadResult> {
  let lastError: unknown;
  const sleep = retry.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < retry.maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    try {
      return await poster(envelope, signal);
    } catch (err) {
      lastError = err;
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) throw err;
      const isLast = attempt === retry.maxAttempts - 1;
      if (isLast) break;
      await sleep(retry.backoffMs(attempt));
    }
  }
  throw lastError ?? new Error('chunk upload failed');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Story 2.1 wired the real presigned-URL pipeline — see
// `lib/recording/presigned-poster.ts`. The legacy fetch-poster below is
// retained for tests and dev fixtures that don't want the auth-fetch +
// /initiate round trip; production code should use
// `createPresignedPoster(...).poster` instead.
export interface FetchPosterOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export function createFetchChunkPoster(options: FetchPosterOptions): ChunkPoster {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async (envelope, signal) => {
    const formData = new FormData();
    formData.append('recordingId', envelope.recordingId);
    formData.append('uploadId', envelope.uploadId);
    formData.append('chunkIndex', String(envelope.chunkIndex));
    formData.append('totalChunks', String(envelope.totalChunks));
    formData.append('mimeType', envelope.mimeType);
    formData.append('chunk', envelope.blob, `chunk-${envelope.chunkIndex}.bin`);
    const init: RequestInit = { method: 'POST', body: formData };
    if (signal !== undefined) init.signal = signal;
    const res = await fetchImpl(options.endpoint, init);
    if (!res.ok) {
      throw new Error(`chunk upload failed: ${res.status}`);
    }
    const data = (await res.json().catch(() => ({}))) as { etag?: string };
    return {
      chunkIndex: envelope.chunkIndex,
      etag: data.etag ?? `mock-etag-${envelope.chunkIndex}`,
    };
  };
}
