/**
 * Reusable error banner for the auth surfaces. Renders RFC 7807
 * problem-details (title + detail + requestId) when supplied; falls back
 * to a generic message for unknown errors.
 */

import { AuthFetchError } from '../../../lib/auth/auth-fetch';

export interface AuthErrorProps {
  error: unknown;
  /** Optional override message; takes precedence over the error's `detail`. */
  message?: string;
}

export function AuthError({ error, message }: AuthErrorProps) {
  if (!error && !message) return null;
  const text = message ?? deriveMessage(error);
  const requestId = error instanceof AuthFetchError ? error.problem.requestId : undefined;
  return (
    <div
      role="alert"
      data-testid="auth-error"
      className="rounded-md border border-border bg-surface p-3 text-sm text-fg"
    >
      <p className="font-medium">{text}</p>
      {requestId ? (
        <p className="mt-1 text-xs text-fg-muted">
          Reference: <code className="font-mono">{requestId}</code>
        </p>
      ) : null}
    </div>
  );
}

function deriveMessage(error: unknown): string {
  if (error instanceof AuthFetchError) {
    return error.problem.detail ?? error.problem.title ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
