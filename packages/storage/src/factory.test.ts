import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { NotImplementedError } from './errors.js';
import { createStorageProvider } from './factory.js';
import { S3StorageProvider } from './s3-provider.js';

describe('createStorageProvider', () => {
  it('returns S3StorageProvider for kind: s3', () => {
    const provider = createStorageProvider({
      kind: 's3',
      region: 'us-east-1',
      bucket: 'aisecretary-test',
      client: new S3Client({ region: 'us-east-1' }),
    });
    expect(provider).toBeInstanceOf(S3StorageProvider);
  });

  it('throws NotImplementedError for kind: azure-blob', () => {
    expect(() =>
      createStorageProvider({
        kind: 'azure-blob',
        accountName: 'acct',
        container: 'c',
      }),
    ).toThrow(NotImplementedError);
  });

  it('throws NotImplementedError for kind: gcs', () => {
    expect(() => createStorageProvider({ kind: 'gcs', bucket: 'b' })).toThrow(NotImplementedError);
  });

  it('throws NotImplementedError for kind: minio', () => {
    expect(() =>
      createStorageProvider({
        kind: 'minio',
        endpoint: 'http://localhost:9000',
        bucket: 'b',
        accessKey: 'a',
        secretKey: 's',
      }),
    ).toThrow(NotImplementedError);
  });
});
