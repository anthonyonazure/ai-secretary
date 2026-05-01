/**
 * Story 1.5d — admin invite-create form (web).
 *
 * Captures email + role (+ optional ttlDays). Reuses the SignupForm's
 * shape (zod resolver + react-hook-form + RFC 7807 setError mapping).
 */

import {
  type CreateInviteRequest,
  createInviteRequestSchema,
} from '@aisecretary/shared/schemas/invites';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Path, useForm } from 'react-hook-form';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AuthError } from '../auth/auth-error';

export interface InviteCreateFormProps {
  onSubmit: (values: CreateInviteRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<CreateInviteRequest>> = ['email', 'role', 'ttlDays'];

export function InviteCreateForm({ onSubmit, serverError, isSubmitting }: InviteCreateFormProps) {
  const form = useForm<CreateInviteRequest>({
    resolver: zodResolver(createInviteRequestSchema),
    defaultValues: { email: '', role: 'org_member' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset({ email: '', role: 'org_member' });
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Invite a new member"
      className="flex w-full flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      {serverError ? <AuthError error={serverError} /> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="invite-email" className="text-sm font-medium text-fg">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          autoComplete="email"
          aria-invalid={form.formState.errors.email ? 'true' : 'false'}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="invite-role" className="text-sm font-medium text-fg">
          Role
        </label>
        <select
          id="invite-role"
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-invalid={form.formState.errors.role ? 'true' : 'false'}
          {...form.register('role')}
        >
          <option value="org_admin">Admin</option>
          <option value="org_member">Member</option>
          <option value="org_viewer">Viewer</option>
        </select>
        {form.formState.errors.role ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.role.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="invite-ttl" className="text-sm font-medium text-fg">
          Expires in (days)
        </label>
        <input
          id="invite-ttl"
          type="number"
          min={1}
          max={30}
          placeholder="7"
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-invalid={form.formState.errors.ttlDays ? 'true' : 'false'}
          {...form.register('ttlDays', {
            // Empty input → undefined (zod field is optional). Otherwise
            // coerce to a number. Avoids NaN-validation on a blank field.
            setValueAs: (v: string | number | null | undefined) => {
              if (v === '' || v === null || v === undefined) return undefined;
              const n = typeof v === 'number' ? v : Number(v);
              return Number.isNaN(n) ? undefined : n;
            },
          })}
        />
        <p className="text-xs text-fg-muted">Default 7 days. Maximum 30 days.</p>
        {form.formState.errors.ttlDays ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.ttlDays.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        data-testid="invite-create-submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Sending invite…' : 'Send invite'}
      </button>
    </form>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<CreateInviteRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<CreateInviteRequest>, message);
    }
  }
}
