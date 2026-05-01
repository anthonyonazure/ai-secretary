/**
 * Story 1.5a — login form.
 *
 * Email + password only for this slice. OAuth (Story 1.5b) and MFA
 * (Story 1.5c) attach later by extending this same surface.
 *
 * Story 1.9 — user-facing strings are routed through the `useT` hook;
 * keys live in `apps/web/src/i18n/locales/{en,fr}.json`.
 */

import { type LoginRequest, loginRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Path, useForm } from 'react-hook-form';
import { useT } from '../../../i18n/use-t';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AuthError } from './auth-error';

export interface LoginFormProps {
  onSubmit: (values: LoginRequest) => Promise<void>;
  serverError?: unknown;
  onSwitchToSignup?: () => void;
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<LoginRequest>> = ['email', 'password'];

export function LoginForm({
  onSubmit,
  serverError,
  onSwitchToSignup,
  isSubmitting,
}: LoginFormProps) {
  const { t } = useT();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (err) {
      applyServerErrors(err, (path, message) => form.setError(path, { type: 'server', message }));
    }
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-label={t('auth.login.formLabel')}
      className="flex w-full max-w-md flex-col gap-4"
    >
      {serverError ? <AuthError error={serverError} /> : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="login-email" className="text-sm font-medium text-fg">
          {t('auth.login.email')}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={form.formState.errors.email ? 'true' : 'false'}
          {...form.register('email')}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="login-password" className="text-sm font-medium text-fg">
          {t('auth.login.password')}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={form.formState.errors.password ? 'true' : 'false'}
          {...form.register('password')}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        data-testid="login-submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent"
            />
            {t('auth.login.submitting')}
          </span>
        ) : (
          t('auth.login.submit')
        )}
      </button>

      {onSwitchToSignup ? (
        <p className="text-center text-sm text-fg-muted">
          {t('auth.login.noAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-accent underline-offset-4 hover:underline"
          >
            {t('auth.login.signUp')}
          </button>
        </p>
      ) : null}
    </form>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<LoginRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
    if ((FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<LoginRequest>, message);
    }
  }
}
