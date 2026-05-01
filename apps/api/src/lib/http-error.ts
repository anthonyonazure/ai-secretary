/**
 * `HttpError` class hierarchy.
 *
 * Route handlers throw these; the `error-handler` plugin converts them to
 * RFC 7807 Problem Details. Never throw a plain `Error` from a route — the
 * generic 500 path strips detail by design.
 */
export type ProblemType = 'about:blank' | `https://aisecretary.app/errors/${string}`;

export interface HttpErrorOptions {
  /** Optional machine-readable problem-type URI. */
  type?: ProblemType;
  /** Optional structured cause for logs (never serialized to clients). */
  cause?: unknown;
  /** Optional structured extension fields (RFC 7807 § 3.2). */
  extensions?: Record<string, unknown>;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly type: ProblemType;
  public readonly extensions: Record<string, unknown>;

  constructor(status: number, title: string, detail: string, options: HttpErrorOptions = {}) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.title = title;
    this.type = options.type ?? 'about:blank';
    this.extensions = options.extensions ?? {};
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ValidationError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(422, 'Validation Failed', detail, {
      type: 'https://aisecretary.app/errors/validation',
      ...options,
    });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(404, 'Not Found', detail, {
      type: 'https://aisecretary.app/errors/not-found',
      ...options,
    });
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(403, 'Forbidden', detail, {
      type: 'https://aisecretary.app/errors/forbidden',
      ...options,
    });
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(401, 'Unauthorized', detail, {
      type: 'https://aisecretary.app/errors/unauthorized',
      ...options,
    });
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(409, 'Conflict', detail, {
      type: 'https://aisecretary.app/errors/conflict',
      ...options,
    });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends HttpError {
  constructor(detail: string, options: HttpErrorOptions = {}) {
    super(429, 'Too Many Requests', detail, {
      type: 'https://aisecretary.app/errors/rate-limit',
      ...options,
    });
    this.name = 'RateLimitError';
  }
}

export const isHttpError = (err: unknown): err is HttpError => err instanceof HttpError;
