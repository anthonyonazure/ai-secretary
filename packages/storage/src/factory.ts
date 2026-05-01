/**
 * `createStorageProvider` — selects the concrete `StorageProvider`
 * implementation for the running deployment topology.
 *
 * Story 2.1 only ships the S3 implementation. Azure Blob, GCS, and MinIO
 * slots reserve the type union; calling them throws `NotImplementedError`
 * with the follow-up Story marker. This keeps `apps/api` from accidentally
 * shipping with a half-implemented provider — the build fails loud.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { NotImplementedError } from './errors.js';
import { S3StorageProvider } from './s3-provider.js';
import type { StorageProvider, StorageProviderKind } from './types.js';

export interface S3FactoryConfig {
  kind: 's3';
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  /** Pre-built client (tests). */
  client?: S3Client;
}

export interface AzureBlobFactoryConfig {
  kind: 'azure-blob';
  accountName: string;
  container: string;
}

export interface GcsFactoryConfig {
  kind: 'gcs';
  bucket: string;
}

export interface MinioFactoryConfig {
  kind: 'minio';
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export type CreateStorageProviderConfig =
  | S3FactoryConfig
  | AzureBlobFactoryConfig
  | GcsFactoryConfig
  | MinioFactoryConfig;

export const createStorageProvider = (config: CreateStorageProviderConfig): StorageProvider => {
  switch (config.kind) {
    case 's3': {
      const client =
        config.client ??
        new S3Client({
          region: config.region,
          ...(config.endpoint !== undefined ? { endpoint: config.endpoint } : {}),
          ...(config.forcePathStyle !== undefined ? { forcePathStyle: config.forcePathStyle } : {}),
          ...(config.credentials !== undefined ? { credentials: config.credentials } : {}),
        });
      return new S3StorageProvider({ client, bucket: config.bucket });
    }
    case 'azure-blob':
      throw new NotImplementedError(
        // TODO(post-2.1): packages/storage azure-blob provider.
        'azure-blob storage provider is not implemented yet (TODO post-2.1).',
      );
    case 'gcs':
      throw new NotImplementedError(
        // TODO(post-2.1): packages/storage gcs provider.
        'gcs storage provider is not implemented yet (TODO post-2.1).',
      );
    case 'minio':
      throw new NotImplementedError(
        // TODO(post-2.1): packages/storage minio provider (likely thin wrapper around S3 with custom endpoint).
        'minio storage provider is not implemented yet (TODO post-2.1).',
      );
    default: {
      const _exhaustive: never = config;
      void _exhaustive;
      throw new NotImplementedError(
        `Unknown storage provider kind: ${(config as { kind: StorageProviderKind }).kind}`,
      );
    }
  }
};
