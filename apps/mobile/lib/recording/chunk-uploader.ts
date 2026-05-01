/**
 * Mobile chunk uploader — same primitive shape as the web counterpart so
 * Story 4.5 can re-use the retry-policy contract on both platforms. On RN
 * the input is a local file URI (from expo-audio + expo-file-system), so
 * we slice via byte-range reads rather than `Blob.slice`. The injected
 * `poster` is the mockable HTTP boundary; the default poster does a
 * standard `fetch` POST with the chunk bytes as the body.
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
  /** Base64-encoded chunk bytes; expo-file-system's `readAsStringAsync` returns base64. */
  base64: string;
  byteLength: number;
}

export interface ChunkUploadResult {
  chunkIndex: number;
  etag: string;
}

export type ChunkPoster = (envelope: UploadEnvelope) => Promise<ChunkUploadResult>;

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: (attempt) => Math.min(2 ** attempt * 500, 5_000),
};

export const DEFAULT_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

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

export interface ChunkSource {
  /** Total bytes the source represents. */
  totalSize: number;
  /** Returns base64-encoded bytes for `[start, end)`. */
  readSlice: (range: ChunkRange) => Promise<string>;
}

export interface UploadAllParams {
  recordingId: string;
  uploadId: string;
  source: ChunkSource;
  mimeType: string;
  chunkSize?: number;
  poster: ChunkPoster;
  retry?: RetryPolicy;
  onProgress?: (fraction: number) => void;
}

export async function uploadSourceInChunks(params: UploadAllParams): Promise<ChunkUploadResult[]> {
  const {
    recordingId,
    uploadId,
    source,
    mimeType,
    chunkSize = DEFAULT_CHUNK_SIZE_BYTES,
    poster,
    retry = DEFAULT_RETRY_POLICY,
    onProgress,
  } = params;

  const ranges = planChunks(source.totalSize, chunkSize);
  if (ranges.length === 0) {
    onProgress?.(1);
    return [];
  }

  const results: ChunkUploadResult[] = [];
  for (const range of ranges) {
    const base64 = await source.readSlice(range);
    const result = await postWithRetry(
      {
        recordingId,
        uploadId,
        chunkIndex: range.index,
        totalChunks: ranges.length,
        mimeType,
        base64,
        byteLength: range.end - range.start,
      },
      poster,
      retry,
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
): Promise<ChunkUploadResult> {
  let lastError: unknown;
  const sleep = retry.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < retry.maxAttempts; attempt += 1) {
    try {
      return await poster(envelope);
    } catch (err) {
      lastError = err;
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
// kept for tests / dev fixtures only.
export interface FetchPosterOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export function createFetchChunkPoster(options: FetchPosterOptions): ChunkPoster {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  return async (envelope) => {
    const res = await fetchImpl(options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordingId: envelope.recordingId,
        uploadId: envelope.uploadId,
        chunkIndex: envelope.chunkIndex,
        totalChunks: envelope.totalChunks,
        mimeType: envelope.mimeType,
        byteLength: envelope.byteLength,
        base64: envelope.base64,
      }),
    });
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
