/**
 * Typed error hierarchy for the transcription package.
 *
 * Worker handlers catch `TranscriptionError` (the base class) and map to
 * a `recordings.status = 'failed'` row write with `failure_reason`. Other
 * exception types are bugs — let them propagate.
 */

export class TranscriptionError extends Error {
  override readonly name: string = 'TranscriptionError';
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class TranscriptionTimeoutError extends TranscriptionError {
  override readonly name: string = 'TranscriptionTimeoutError';
  constructor(timeoutMs: number, cause?: unknown) {
    super(`Transcription timed out after ${timeoutMs}ms`, cause);
  }
}

export class TranscriptionProviderError extends TranscriptionError {
  override readonly name: string = 'TranscriptionProviderError';
  constructor(
    public readonly providerKind: string,
    message: string,
    cause?: unknown,
  ) {
    super(`[${providerKind}] ${message}`, cause);
  }
}
