/**
 * Typed errors for the CRM gateway. Mirrors `packages/llm-gateway/src/errors.ts`.
 *
 * Callers can branch on `err instanceof CrmProviderUnavailableError` /
 * `CrmAuthError` / `CrmRateLimitError` to decide retry policy.
 */

import type { CrmProviderKind } from './types.js';

export class CrmError extends Error {
  constructor(
    message: string,
    public readonly providerKind: CrmProviderKind,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'CrmError';
  }
}

/** Thrown by the constructor when required config fields are missing. */
export class CrmProviderUnavailableError extends CrmError {
  constructor(providerKind: CrmProviderKind, missingField: string) {
    super(
      `CRM provider ${providerKind} unavailable — missing config: ${missingField}`,
      providerKind,
      false,
    );
    this.name = 'CrmProviderUnavailableError';
  }
}

/** 401/403 from the provider — token expired or scopes insufficient. */
export class CrmAuthError extends CrmError {
  constructor(providerKind: CrmProviderKind, message: string) {
    super(`CRM auth failed for ${providerKind}: ${message}`, providerKind, false);
    this.name = 'CrmAuthError';
  }
}

/** 429 / rate-limit — retryable with backoff. */
export class CrmRateLimitError extends CrmError {
  constructor(
    providerKind: CrmProviderKind,
    public readonly retryAfterMs: number | null,
  ) {
    super(
      `CRM rate limit hit for ${providerKind}${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ''}`,
      providerKind,
      true,
    );
    this.name = 'CrmRateLimitError';
  }
}

/** Provider returned a 5xx — retryable. */
export class CrmServerError extends CrmError {
  constructor(providerKind: CrmProviderKind, message: string) {
    super(`CRM provider ${providerKind} server error: ${message}`, providerKind, true);
    this.name = 'CrmServerError';
  }
}

/** Provider returned a 4xx (other than 401/403/429) — not retryable. */
export class CrmRequestError extends CrmError {
  constructor(providerKind: CrmProviderKind, message: string) {
    super(`CRM provider ${providerKind} request error: ${message}`, providerKind, false);
    this.name = 'CrmRequestError';
  }
}
