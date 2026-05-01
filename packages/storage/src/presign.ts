/**
 * Higher-level helpers built on top of `StorageProvider`.
 *
 * `createPresignedUpload` wraps the multipart-init flow so callers (the
 * recordings route handler in `apps/api`) don't need to know about
 * upload-id management vs. single-shot PUT vs. part-presign cadence.
 */

import { z } from 'zod';
import type { MultipartUploadInit, PresignedUrl, StorageProvider } from './types.js';

export const createPresignedUploadInputSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  /** Optional total content length — informational only. */
  size: z.number().int().nonnegative().optional(),
});

export type CreatePresignedUploadInput = z.infer<typeof createPresignedUploadInputSchema>;

export interface CreatePresignedUploadResult {
  /** Provider-issued multipart upload id. */
  uploadId: string;
  /** Echoed key (storage rather than DB key). */
  key: string;
}

/**
 * Initialise a multipart upload and return the upload id + key. The
 * caller is responsible for calling `provider.presignPart(...)` per
 * chunk (see `recordings.ts` in apps/api).
 *
 * Returning *only* the upload id — not all part URLs up front — is
 * deliberate. Pre-minting N URLs at create time wastes bandwidth on
 * uploads that get aborted partway and forces clients to commit to a
 * fixed chunk plan before they know the file size. Per-part presign on
 * demand keeps the budget tight (15-min default) and lets the client
 * resume across the 10-min retry budget from arch-addendums § 6.
 */
export const createPresignedUpload = async (
  provider: StorageProvider,
  input: CreatePresignedUploadInput,
): Promise<CreatePresignedUploadResult> => {
  const parsed = createPresignedUploadInputSchema.parse(input);
  const init: MultipartUploadInit = await provider.createMultipartUpload(parsed.key, {
    contentType: parsed.contentType,
  });
  return { uploadId: init.uploadId, key: init.key };
};

/**
 * Convenience for the per-part presign. Mostly here so route handlers
 * don't need to remember the default expiry — they just call this.
 */
export const presignUploadPart = async (
  provider: StorageProvider,
  input: { key: string; uploadId: string; partNumber: number; expiresInSeconds?: number },
): Promise<PresignedUrl> => {
  return await provider.presignPart(input);
};
