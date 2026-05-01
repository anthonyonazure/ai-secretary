import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageError, StorageNotFoundError } from './errors.js';
import { S3StorageProvider } from './s3-provider.js';

const s3Mock = mockClient(S3Client);

const buildProvider = () => {
  // Inject a deterministic signer so tests don't fight real AWS auth resolution.
  const client = new S3Client({ region: 'us-east-1' });
  const signer = vi.fn(async (_client, command, opts: { expiresIn: number }) => {
    const cmdName = command.constructor.name;
    return `https://signed.example/${cmdName}?expires=${opts.expiresIn}`;
  });
  const provider = new S3StorageProvider({ client, bucket: 'aisecretary-test', signer });
  return { provider, signer };
};

describe('S3StorageProvider', () => {
  beforeEach(() => {
    s3Mock.reset();
  });
  afterEach(() => {
    s3Mock.reset();
  });

  it('presignPut returns a signed URL with the configured expiry', async () => {
    const { provider, signer } = buildProvider();
    const result = await provider.presignPut('recordings/abc.webm', {
      contentType: 'audio/webm',
    });
    expect(result.url).toContain('PutObjectCommand');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(signer).toHaveBeenCalledTimes(1);
    const args = signer.mock.calls[0];
    expect(args).toBeDefined();
    const cmd = args?.[1];
    if (!cmd || !(cmd instanceof PutObjectCommand)) {
      throw new Error('expected PutObjectCommand');
    }
    expect(cmd.input.Bucket).toBe('aisecretary-test');
    expect(cmd.input.Key).toBe('recordings/abc.webm');
    expect(cmd.input.ContentType).toBe('audio/webm');
  });

  it('createMultipartUpload returns a provider upload id', async () => {
    const { provider } = buildProvider();
    s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: 'upload-123' });
    const result = await provider.createMultipartUpload('recordings/x.webm', {
      contentType: 'audio/webm',
    });
    expect(result).toEqual({ uploadId: 'upload-123', key: 'recordings/x.webm' });
    const calls = s3Mock.commandCalls(CreateMultipartUploadCommand);
    expect(calls.length).toBe(1);
    const args = calls[0]?.args[0]?.input;
    expect(args?.Bucket).toBe('aisecretary-test');
    expect(args?.Key).toBe('recordings/x.webm');
    expect(args?.ContentType).toBe('audio/webm');
  });

  it('createMultipartUpload throws when provider returns no UploadId', async () => {
    const { provider } = buildProvider();
    s3Mock.on(CreateMultipartUploadCommand).resolves({});
    await expect(
      provider.createMultipartUpload('recordings/x.webm', { contentType: 'audio/webm' }),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it('presignPart signs an UploadPartCommand', async () => {
    const { provider, signer } = buildProvider();
    const result = await provider.presignPart({
      key: 'recordings/x.webm',
      uploadId: 'upload-123',
      partNumber: 3,
    });
    expect(result.url).toContain('UploadPartCommand');
    expect(signer).toHaveBeenCalledTimes(1);
    const cmd = signer.mock.calls[0]?.[1];
    if (!cmd || !(cmd instanceof UploadPartCommand)) {
      throw new Error('expected UploadPartCommand');
    }
    expect(cmd.input.PartNumber).toBe(3);
    expect(cmd.input.UploadId).toBe('upload-123');
  });

  it('completeMultipartUpload sorts parts and returns the etag/location', async () => {
    const { provider } = buildProvider();
    s3Mock
      .on(CompleteMultipartUploadCommand)
      .resolves({ ETag: 'final-etag', Location: 'https://s3/loc' });
    const result = await provider.completeMultipartUpload({
      key: 'recordings/x.webm',
      uploadId: 'upload-123',
      parts: [
        { partNumber: 2, etag: 'etag-2' },
        { partNumber: 1, etag: 'etag-1' },
      ],
    });
    expect(result).toEqual({ etag: 'final-etag', location: 'https://s3/loc' });
    const calls = s3Mock.commandCalls(CompleteMultipartUploadCommand);
    expect(calls.length).toBe(1);
    const parts = calls[0]?.args[0]?.input.MultipartUpload?.Parts;
    expect(parts).toEqual([
      { PartNumber: 1, ETag: 'etag-1' },
      { PartNumber: 2, ETag: 'etag-2' },
    ]);
  });

  it('completeMultipartUpload rejects empty parts list', async () => {
    const { provider } = buildProvider();
    await expect(
      provider.completeMultipartUpload({
        key: 'k',
        uploadId: 'u',
        parts: [],
      }),
    ).rejects.toMatchObject({ code: 'storage.invalid-input' });
  });

  it('abortMultipartUpload sends an AbortMultipartUploadCommand', async () => {
    const { provider } = buildProvider();
    s3Mock.on(AbortMultipartUploadCommand).resolves({});
    await provider.abortMultipartUpload({ key: 'k', uploadId: 'u' });
    expect(s3Mock.commandCalls(AbortMultipartUploadCommand).length).toBe(1);
  });

  it('presignGet signs a GetObjectCommand', async () => {
    const { provider, signer } = buildProvider();
    const result = await provider.presignGet('recordings/x.webm', { expiresInSeconds: 60 });
    expect(result.url).toContain('GetObjectCommand');
    const cmd = signer.mock.calls[0]?.[1];
    if (!cmd || !(cmd instanceof GetObjectCommand)) {
      throw new Error('expected GetObjectCommand');
    }
  });

  it('headObject returns metadata', async () => {
    const { provider } = buildProvider();
    const lastModified = new Date('2026-01-01T00:00:00Z');
    s3Mock.on(HeadObjectCommand).resolves({
      ContentType: 'audio/webm',
      ContentLength: 12345,
      ETag: '"abc"',
      LastModified: lastModified,
    });
    const result = await provider.headObject('k');
    expect(result).toEqual({
      key: 'k',
      contentType: 'audio/webm',
      contentLength: 12345,
      etag: '"abc"',
      lastModified,
    });
  });

  it('headObject translates 404 into StorageNotFoundError', async () => {
    const { provider } = buildProvider();
    const err = new S3ServiceException({
      name: 'NotFound',
      message: 'Not Found',
      $fault: 'client',
      $metadata: { httpStatusCode: 404 },
    });
    s3Mock.on(HeadObjectCommand).rejects(err);
    await expect(provider.headObject('missing')).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it('delete is idempotent on 404', async () => {
    const { provider } = buildProvider();
    const err = new S3ServiceException({
      name: 'NotFound',
      message: 'Not Found',
      $fault: 'client',
      $metadata: { httpStatusCode: 404 },
    });
    s3Mock.on(DeleteObjectCommand).rejects(err);
    await expect(provider.delete('missing')).resolves.toBeUndefined();
  });

  it('delete sends DeleteObjectCommand on success', async () => {
    const { provider } = buildProvider();
    s3Mock.on(DeleteObjectCommand).resolves({});
    await provider.delete('k');
    expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
  });
});
