/**
 * Story 1.5d — accept-invite form (web).
 *
 * Variant of `SignupForm` with the tenant binding pre-resolved by the
 * server-side lookup (passed in via `lookup` prop). The recipient
 * sees:
 *
 *   - Email (read-only display; pulled from invite)
 *   - Workspace + role (read-only display; pulled from invite)
 *   - Name input (writable)
 *   - Password input (writable)
 *
 * The submission shape matches `acceptInviteRequestSchema`.
 */

import {
  type AcceptInviteRequest,
  type InviteLookupResponse,
  acceptInviteRequestSchema,
} from '@aisecretary/shared/schemas/invites';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Path, useForm } from 'react-hook-form';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AuthError } from '../auth/auth-error';

export interface AcceptInviteFormProps {
  /** Invite metadata returned by the public lookup endpoint. */
  lookup: InviteLookupResponse;
  /** Plaintext token from the URL. */
  token: string;
  onSubmit: (values: AcceptInviteRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<AcceptInviteRequest>> = ['name', 'password', 'token'];

export function AcceptInviteForm({
  lookup,
  token,
  onSubmit,
  serverError,
  isSubmitting,
}: AcceptInviteFormProps) {
  const form = useForm<AcceptInviteRequest>({
    resolver: zodResolver(acceptInviteRequestSchema),
    defaultValues: { token, password: '', name: '' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({ ...values, token });
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label={`Accept invitation to ${lookup.tenantName}`}
      className="flex w-full max-w-md flex-col gap-4"
    >
      {serverError ? <AuthError error={serverError} /> : null}

      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-fg">
          You're joining <strong>{lookup.tenantName}</strong> as a <strong>{lookup.role}</strong>.
        </p>
        <p className="text-xs text-fg-muted">
          Invited by {lookup.inviterName}. Email <strong>{lookup.email}</strong>.
        </p>
      </div>

      <input type="hidden" {...form.register('token')} value={token} readOnly />

      <div className="flex flex-col gap-1">
        <label htmlFor="accept-name" className="text-sm font-medium text-fg">
          Your name
        </label>
        <input
          id="accept-name"
          type="text"
          autoComplete="name"
          aria-invalid={form.formState.errors.name ? 'true' : 'false'}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="accept-password" className="text-sm font-medium text-fg">
          Password
        </label>
        <input
          id="accept-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={form.formState.errors.password ? 'true' : 'false'}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...form.register('password')}
        />
        <p className="text-xs text-fg-muted">Minimum 12 characters.</p>
        {form.formState.errors.password ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        data-testid="accept-invite-submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Joining…' : `Join ${lookup.tenantName}`}
      </button>
    </form>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<AcceptInviteRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<AcceptInviteRequest>, message);
    }
  }
}
