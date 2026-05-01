/**
 * Typed error hierarchy for the LLM-gateway.
 *
 * The Fastify `setErrorHandler` (apps/api) maps `LlmRateLimitError` to
 * 429 + Retry-After, `LlmTimeoutError` to 504, everything else under
 * `LlmError` to 502 with a safe message. Anything outside this hierarchy
 * is a bug — let it propagate as 500.
 */

import type { LlmProviderKind } from './types.js';

export class LlmError extends Error {
  override readonly name: string = 'LlmError';
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class LlmTimeoutError extends LlmError {
  override readonly name: string = 'LlmTimeoutError';
  constructor(timeoutMs: number, cause?: unknown) {
    super(`LLM request timed out after ${timeoutMs}ms`, cause);
  }
}

export class LlmRateLimitError extends LlmError {
  override readonly name: string = 'LlmRateLimitError';
  constructor(
    public readonly providerKind: LlmProviderKind,
    /** Seconds to wait before retrying — surfaced on 429 Retry-After. */
    public readonly retryAfterSec: number | undefined,
    cause?: unknown,
  ) {
    super(`[${providerKind}] rate-limited (retry after ${retryAfterSec ?? 'unknown'}s)`, cause);
  }
}

/**
 * Generic provider error — wraps SDK exceptions with a `retryable` flag
 * so the gateway can decide whether to fall back to the next kind in
 * the selector's preference list.
 *
 * `retryable` semantics (provider-mapped):
 *   - 5xx / network errors → retryable: true
 *   - 4xx (auth, malformed request) → retryable: false
 *   - rate-limit → throw `LlmRateLimitError` instead (the gateway treats
 *     these as retryable and respects Retry-After).
 */
export class LlmProviderError extends LlmError {
  override readonly name: string = 'LlmProviderError';
  constructor(
    public readonly providerKind: LlmProviderKind,
    message: string,
    public readonly retryable: boolean,
    public readonly requestId?: string,
    cause?: unknown,
  ) {
    super(`[${providerKind}] ${message}`, cause);
  }
}

/**
 * Thrown by the gateway when `responseSchema` is set but the model's
 * output still fails to parse after the one-shot retry. Distinct from
 * `LlmProviderError` because the API call itself succeeded — the
 * structured-output contract is what failed.
 */
export class LlmSchemaParseError extends LlmError {
  override readonly name: string = 'LlmSchemaParseError';
  constructor(
    message: string,
    public readonly rawText: string,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}
