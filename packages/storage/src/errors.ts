/**
 * Storage error hierarchy.
 *
 * `StorageError` is the base for everything thrown by `StorageProvider`
 * implementations. Routes catch these and translate to RFC 7807; tests
 * assert on the discriminated `name`/`code` fields.
 *
 * Provider-abstraction discipline (CLAUDE.md): callers only see
 * provider-agnostic errors. Underlying SDK errors get wrapped — we never
 * leak `S3ServiceException` past this boundary.
 */

export type StorageErrorCode =
  | 'storage.unknown'
  | 'storage.not-found'
  | 'storage.access-denied'
  | 'storage.not-implemented'
  | 'storage.invalid-input';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public override readonly cause?: unknown;
  constructor(message: string, code: StorageErrorCode = 'storage.unknown', cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(message: string, cause?: unknown) {
    super(message, 'storage.not-found', cause);
    this.name = 'StorageNotFoundError';
  }
}

export class NotImplementedError extends StorageError {
  constructor(message: string) {
    super(message, 'storage.not-implemented');
    this.name = 'NotImplementedError';
  }
}
