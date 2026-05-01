/**
 * Story 1.5c — MFA challenge form.
 *
 * Rendered after `/login` returns `kind: 'mfa-required'`. Accepts either
 * a 6-digit TOTP code or a recovery code (4-4-4 hex). Toggling between
 * the two surfaces a different label + autocomplete hint.
 */

import { type VerifyMfaRequest, verifyMfaRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthError } from './auth-error';

export interface MfaChallengeFormProps {
  challengeToken: string;
  onSubmit: (values: VerifyMfaRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
  /** Hide the recovery-code toggle when the user is forced to enroll. */
  hideRecoveryToggle?: boolean;
}

type FormValues = { code: string };

export function MfaChallengeForm({
  challengeToken,
  onSubmit,
  serverError,
  isSubmitting,
  hideRecoveryToggle,
}: MfaChallengeFormProps) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(verifyMfaRequestSchema.pick({ code: true })),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async ({ code }) => {
    try {
      await onSubmit({ challengeToken, code });
    } catch {
      // Server error is rendered via the `serverError` prop.
    }
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label="Verify your identity"
      className="flex w-full max-w-md flex-col gap-4"
    >
      {serverError ? <AuthError error={serverError} /> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="mfa-code" className="text-sm font-medium text-fg">
          {useRecoveryCode ? 'Recovery code' : 'Authentication code'}
        </label>
        <input
          id="mfa-code"
          type="text"
          inputMode={useRecoveryCode ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          aria-invalid={form.formState.errors.code ? 'true' : 'false'}
          // biome-ignore lint/a11y/noAutofocus: MFA challenge is the primary action on this surface; auto-focus matches the locked UX spec for the challenge form (one-tap from email/SMS code).
          autoFocus
          {...form.register('code')}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm tracking-widest text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {form.formState.errors.code ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.code.message}
          </p>
        ) : null}
        <p className="text-xs text-fg-muted">
          {useRecoveryCode
            ? 'Enter one of the recovery codes you saved during enrollment.'
            : 'Open your authenticator app and enter the 6-digit code.'}
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        data-testid="mfa-verify-submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Verifying…' : 'Verify'}
      </button>

      {hideRecoveryToggle ? null : (
        <button
          type="button"
          onClick={() => {
            setUseRecoveryCode((v) => !v);
            form.reset({ code: '' });
          }}
          data-testid="mfa-toggle-recovery"
          className="text-center text-sm text-accent underline-offset-4 hover:underline"
        >
          {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
        </button>
      )}
    </form>
  );
}
