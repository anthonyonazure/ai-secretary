/**
 * `S3StorageProvider` — concrete implementation of `StorageProvider`
 * against AWS S3 (and S3-compatible services like MinIO).
 *
 * Only this file imports `@aws-sdk/client-s3` + `@aws-sdk/s3-request-
 * presigner` — that's the provider-abstraction discipline from CLAUDE.md.
 * Callers (`apps/api`, `apps/workers`) work in terms of the
 * `StorageProvider` interface only.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageError, StorageNotFoundError } from './errors.js';
import {
  DEFAULT_GET_EXPIRY_SECONDS,
  DEFAULT_PART_EXPIRY_SECONDS,
  DEFAULT_PUT_EXPIRY_SECONDS,
  type MultipartCompleteResult,
  type MultipartPart,
  type MultipartUploadInit,
  type ObjectMetadata,
  type PresignedPutOptions,
  type PresignedUrl,
  type StorageProvider,
} from './types.js';

export interface S3StorageProviderOptions {
  /** Pre-built S3 client. Tests inject a mocked one; production builds it from env. */
  client: S3Client;
  bucket: string;
  /**
   * Optional override for `getSignedUrl` (used by `aws-sdk-client-mock`
   * test setups that want to skip real signing).
   */
  signer?: typeof getSignedUrl;
}

const computeExpiresAt = (expiresInSeconds: number): Date =>
  new Date(Date.now() + expiresInSeconds * 1000);

const wrapS3Error = (err: unknown, action: string): never => {
  if (err instanceof S3ServiceException) {
    if (err.name === 'NotFound' || err.$metadata.httpStatusCode === 404) {
      throw new StorageNotFoundError(`${action}: object not found`, err);
    }
    if (err.$metadata.httpStatusCode === 403) {
      throw new StorageError(`${action}: access denied`, 'storage.access-denied', err);
    }
  }
  throw new StorageError(
    `${action}: ${err instanceof Error ? err.message : String(err)}`,
    'storage.unknown',
    err,
  );
};

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signer: typeof getSignedUrl;

  constructor(options: S3StorageProviderOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
    this.signer = options.signer ?? getSignedUrl;
  }

  async presignPut(key: string, opts: PresignedPutOptions): Promise<PresignedUrl> {
    const expiresIn = opts.expiresInSeconds ?? DEFAULT_PUT_EXPIRY_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
      ...(opts.maxSizeBytes !== undefined ? { ContentLength: opts.maxSizeBytes } : {}),
    });
    try {
      const url = await this.signer(this.client, command, { expiresIn });
      return { url, expiresAt: computeExpiresAt(expiresIn) };
    } catch (err) {
      return wrapS3Error(err, 'presignPut');
    }
  }

  async createMultipartUpload(
    key: string,
    opts: { contentType: string },
  ): Promise<MultipartUploadInit> {
    try {
      const result = await this.client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: opts.contentType,
        }),
      );
      if (!result.UploadId) {
        throw new StorageError(
          'createMultipartUpload: provider returned no upload id',
          'storage.unknown',
        );
      }
      return { uploadId: result.UploadId, key };
    } catch (err) {
      if (err instanceof StorageError) throw err;
      return wrapS3Error(err, 'createMultipartUpload');
    }
  }

  async presignPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds?: number;
  }): Promise<PresignedUrl> {
    const expiresIn = input.expiresInSeconds ?? DEFAULT_PART_EXPIRY_SECONDS;
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
    });
    try {
      const url = await this.signer(this.client, command, { expiresIn });
      return { url, expiresAt: computeExpiresAt(expiresIn) };
    } catch (err) {
      return wrapS3Error(err, 'presignPart');
    }
  }

  async uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Uint8Array;
    contentType?: string;
  }): Promise<MultipartPart> {
    try {
      const result = await this.client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: input.key,
          UploadId: input.uploadId,
          PartNumber: input.partNumber,
          Body: input.body,
          ...(input.contentType !== undefined ? { ContentType: input.contentType } : {}),
        }),
      );
      if (!result.ETag) {
        throw new StorageError('uploadPart: provider returned no etag', 'storage.unknown');
      }
      return { partNumber: input.partNumber, etag: result.ETag };
    } catch (err) {
      if (err instanceof StorageError) throw err;
      return wrapS3Error(err, 'uploadPart');
    }
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<MultipartCompleteResult> {
    if (input.parts.length === 0) {
      throw new StorageError(
        'completeMultipartUpload: parts must be non-empty',
        'storage.invalid-input',
      );
    }
    // S3 requires the parts list sorted by part number ascending.
    const sortedParts = [...input.parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));
    try {
      const result = await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: input.key,
          UploadId: input.uploadId,
          MultipartUpload: { Parts: sortedParts },
        }),
      );
      return {
        etag: result.ETag ?? '',
        location: result.Location ?? `s3://${this.bucket}/${input.key}`,
      };
    } catch (err) {
      return wrapS3Error(err, 'completeMultipartUpload');
    }
  }

  async abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: input.key,
          UploadId: input.uploadId,
        }),
      );
    } catch (err) {
      wrapS3Error(err, 'abortMultipartUpload');
    }
  }

  async presignGet(key: string, opts: { expiresInSeconds: number }): Promise<PresignedUrl> {
    const expiresIn = opts.expiresInSeconds ?? DEFAULT_GET_EXPIRY_SECONDS;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    try {
      const url = await this.signer(this.client, command, { expiresIn });
      return { url, expiresAt: computeExpiresAt(expiresIn) };
    } catch (err) {
      return wrapS3Error(err, 'presignGet');
    }
  }

  async headObject(key: string): Promise<ObjectMetadata> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        contentType: result.ContentType ?? null,
        contentLength: typeof result.ContentLength === 'number' ? result.ContentLength : null,
        etag: result.ETag ?? null,
        lastModified: result.LastModified ?? null,
      };
    } catch (err) {
      return wrapS3Error(err, 'headObject');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      // Idempotent: swallow not-found.
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
        return;
      }
      wrapS3Error(err, 'delete');
    }
  }
}
