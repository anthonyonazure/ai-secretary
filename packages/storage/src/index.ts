/**
 * `@aisecretary/storage` — provider-agnostic blob storage abstraction.
 *
 * Public surface:
 *   - Types/contracts: `StorageProvider`, `PresignedUrl`,
 *     `MultipartUploadInit`, `MultipartPart`, `MultipartCompleteResult`,
 *     `ObjectMetadata`, `PresignedPutOptions`.
 *   - Implementation: `S3StorageProvider` (S3 + S3-compatible).
 *   - Factory: `createStorageProvider({ kind: 's3' | … })`.
 *   - Helpers: `createPresignedUpload`, `presignUploadPart`.
 *   - Errors: `StorageError`, `StorageNotFoundError`, `NotImplementedError`.
 *
 * Provider-abstraction discipline (CLAUDE.md): consumers (`apps/api`,
 * `apps/workers`) only ever import from this package — they must NOT
 * import `@aws-sdk/*` directly. Build-time grep checks enforce this.
 */

export const PACKAGE_NAME = '@aisecretary/storage';

export * from './types.js';
export * from './errors.js';
export * from './s3-provider.js';
export * from './factory.js';
export * from './presign.js';
