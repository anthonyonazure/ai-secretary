/**
 * Provider-agnostic storage contract.
 *
 * Every concrete provider (`S3StorageProvider`, future `AzureBlob…`,
 * `GoogleCloudStorage…`, `MinioStorageProvider`) implements
 * `StorageProvider`. Callers — `apps/api`, `apps/workers` — only ever
 * import these types, never SDK clients directly. That's the
 * provider-abstraction discipline from CLAUDE.md: S3/Azure/GCS SDKs are
 * imported only inside `packages/storage`.
 *
 * Multipart strategy:
 *   - The control plane (`apps/api`) calls `createMultipartUpload`,
 *     hands `presignPart` URLs to the client one part at a time, and
 *     finalises with `completeMultipartUpload`. This matches the
 *     resumable-upload primitive Story 4.2 already shipped on the
 *     client (chunked PUT with idempotent resume) — Story 2.1 swaps
 *     the dependency-injected poster to use real presigned URLs.
 *   - Single-shot `presignPut` is for non-recording uploads (avatars,
 *     attachments) where the file is small enough to PUT in one go.
 *
 * Default presigned-URL expiry: 15 minutes. Configurable per call.
 *   - 15 minutes is the de-facto industry default (S3 console, Stripe
 *     uploads, Cloudflare R2). Long enough that a slow client over a
 *     marginal mobile connection won't time out mid-PUT; short enough
 *     that a leaked URL has a small attack window.
 */

export interface PresignedPutOptions {
  contentType: string;
  /** Override expiry; defaults to 900 seconds (15 minutes). */
  expiresInSeconds?: number;
  /** Optional content-length-range constraint (some providers honor it). */
  maxSizeBytes?: number;
}

export interface PresignedUrl {
  url: string;
  /** Absolute expiry timestamp. Clients use this for retry/budget checks. */
  expiresAt: Date;
}

export interface MultipartUploadInit {
  /** Provider-issued upload id. Round-trips to every part + complete + abort call. */
  uploadId: string;
  /** Object key (echoed back for convenience — useful in DB writes). */
  key: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export interface MultipartCompleteResult {
  etag: string;
  /** Provider-canonical resource location (often a https URL). */
  location: string;
}

export interface ObjectMetadata {
  key: string;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  lastModified: Date | null;
}

/**
 * Provider-agnostic storage contract. Every concrete provider implements
 * this; only `S3StorageProvider` ships in Story 2.1 — Azure / GCS / MinIO
 * implementations are stubs that throw `NotImplementedError`.
 */
export interface StorageProvider {
  /** Single-shot upload (small files, &lt; 5 MB). */
  presignPut(key: string, opts: PresignedPutOptions): Promise<PresignedUrl>;

  /** Begin a multipart upload — returns a provider-issued upload id. */
  createMultipartUpload(key: string, opts: { contentType: string }): Promise<MultipartUploadInit>;

  /** Presign a single part PUT URL. */
  presignPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds?: number;
  }): Promise<PresignedUrl>;

  /**
   * Server-side direct part upload — used by long-running services
   * (e.g. `apps/bot`) that hold the bytes in process and don't benefit
   * from a presigned-URL round-trip. Returns the provider-issued etag
   * for `completeMultipartUpload`.
   *
   * `apps/api` does NOT use this — the recording upload flow keeps the
   * bytes on the client, so presigned URLs (presignPart) are correct
   * there. Story 9.x (bot service) introduced this method.
   */
  uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Uint8Array;
    /** Optional explicit content-type echoed in the request. */
    contentType?: string;
  }): Promise<MultipartPart>;

  /** Finalise a multipart upload. Provider concatenates parts in order. */
  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartPart[];
  }): Promise<MultipartCompleteResult>;

  /** Cancel an in-flight multipart upload. */
  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void>;

  /** Generate a presigned GET URL (used by the playback flow). */
  presignGet(key: string, opts: { expiresInSeconds: number }): Promise<PresignedUrl>;

  /** HEAD an object — returns metadata, throws StorageNotFoundError if missing. */
  headObject(key: string): Promise<ObjectMetadata>;

  /** Permanent delete. Idempotent — missing keys do not throw. */
  delete(key: string): Promise<void>;
}

/**
 * Provider kind discriminator. Used by `createStorageProvider` to pick
 * the implementation at boot. Only `'s3'` is implemented in Story 2.1;
 * the others reserve their slot for follow-up stories.
 */
export type StorageProviderKind = 's3' | 'azure-blob' | 'gcs' | 'minio';

/** Defaults used everywhere we don't get an explicit override. */
export const DEFAULT_PUT_EXPIRY_SECONDS = 15 * 60;
export const DEFAULT_PART_EXPIRY_SECONDS = 15 * 60;
export const DEFAULT_GET_EXPIRY_SECONDS = 15 * 60;
