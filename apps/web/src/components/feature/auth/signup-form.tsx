/**
 * Story 1.5a — signup form.
 *
 * react-hook-form + zod resolver against the frozen
 * `signupRequestSchema` wire contract. Maps RFC 7807 field-level errors
 * (problem.errors keyed by JSON pointer / path) onto form fields via
 * `setError`; falls back to the banner via `<AuthError>` for top-level
 * messages.
 *
 * Story 1.9 — user-facing strings are routed through the `useT` hook;
 * keys live in `apps/web/src/i18n/locales/{en,fr}.json`.
 */

import {
  type Region,
  type SignupRequest,
  signupRequestSchema,
} from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Path, useForm } from 'react-hook-form';
import { useT } from '../../../i18n/use-t';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AuthError } from './auth-error';

export interface SignupFormProps {
  onSubmit: (values: SignupRequest) => Promise<void>;
  /** Caller-provided server error to surface above the form. */
  serverError?: unknown;
  /** Caller-provided "switch to login" handler. */
  onSwitchToLogin?: () => void;
  /** Default region — pre-selected; user can still flip. */
  defaultRegion?: Region;
  /** Disables the form when the parent is mid-submission. */
  isSubmitting?: boolean;
}

const FIELD_PATHS: ReadonlyArray<Path<SignupRequest>> = [
  'tenantName',
  'region',
  'email',
  'password',
  'name',
];

export function SignupForm({
  onSubmit,
  serverError,
  onSwitchToLogin,
  defaultRegion = 'us',
  isSubmitting,
}: SignupFormProps) {
  const { t } = useT();
  const form = useForm<SignupRequest>({
    resolver: zodResolver(signupRequestSchema),
    defaultValues: {
      tenantName: '',
      region: defaultRegion,
      email: '',
      password: '',
      name: '',
    },
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
      aria-label={t('auth.signup.formLabel')}
      className="flex w-full max-w-md flex-col gap-4"
    >
      {serverError ? <AuthError error={serverError} /> : null}

      <Field
        id="signup-name"
        label={t('auth.signup.name')}
        autoComplete="name"
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />

      <Field
        id="signup-tenant"
        label={t('auth.signup.tenantName')}
        autoComplete="organization"
        error={form.formState.errors.tenantName?.message}
        {...form.register('tenantName')}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-region" className="text-sm font-medium text-fg">
          {t('auth.signup.region')}
        </label>
        <select
          id="signup-region"
          aria-invalid={form.formState.errors.region ? 'true' : 'false'}
          {...form.register('region')}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="us">{t('auth.signup.region.us')}</option>
          <option value="eu">{t('auth.signup.region.eu')}</option>
        </select>
        <p className="text-xs text-fg-muted">{t('auth.signup.region.helper')}</p>
        {form.formState.errors.region ? (
          <p className="text-xs text-fg" role="alert">
            {form.formState.errors.region.message}
          </p>
        ) : null}
      </div>

      <Field
        id="signup-email"
        label={t('auth.signup.email')}
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />

      <Field
        id="signup-password"
        label={t('auth.signup.password')}
        type="password"
        autoComplete="new-password"
        helper={t('auth.signup.password.helper')}
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />

      <button
        type="submit"
        disabled={submitting}
        data-testid="signup-submit"
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Spinner label={t('auth.signup.submitting')} /> : t('auth.signup.submit')}
      </button>

      {onSwitchToLogin ? (
        <p className="text-center text-sm text-fg-muted">
          {t('auth.signup.haveAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-accent underline-offset-4 hover:underline"
          >
            {t('auth.signup.signIn')}
          </button>
        </p>
      ) : null}
    </form>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  helper?: string;
  error?: string | undefined;
}

const Field = function Field({ id, label, helper, error, ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? 'true' : 'false'}
        className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        {...rest}
      />
      {helper && !error ? <p className="text-xs text-fg-muted">{helper}</p> : null}
      {error ? (
        <p className="text-xs text-fg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent"
      />
      <span>{label}</span>
    </span>
  );
}

function applyServerErrors(
  error: unknown,
  setError: (path: Path<SignupRequest>, message: string) => void,
): void {
  if (!(error instanceof AuthFetchError)) return;
  const fieldErrors = error.problem.errors;
  if (!fieldErrors) return;
  for (const [rawKey, messages] of Object.entries(fieldErrors)) {
    const path = normalisePath(rawKey);
    if (path && (FIELD_PATHS as ReadonlyArray<string>).includes(path)) {
      const message = messages?.[0] ?? error.problem.detail ?? error.message;
      setError(path as Path<SignupRequest>, message);
    }
  }
}

/** Strip a leading `/` (JSON pointer) so '/email' → 'email'. */
function normalisePath(input: string): string {
  return input.startsWith('/') ? input.slice(1) : input;
}
