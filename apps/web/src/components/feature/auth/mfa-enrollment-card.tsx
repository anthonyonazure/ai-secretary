/**
 * Story 1.5c — MFA enrollment card.
 *
 * Renders the QR + manual secret + recovery codes plus the 6-digit
 * confirm field. Two states:
 *   - waiting for confirm (QR + secret + recovery codes + form)
 *   - confirmed (callers swap to a "MFA enabled" status surface)
 *
 * Uses the existing `qrcode` dependency (added by Story 4.3 for consent
 * QR rendering) to render the otpauth URI as an SVG data-URL.
 */

import { type MfaConfirmRequest, mfaConfirmRequestSchema } from '@aisecretary/shared/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthError } from './auth-error';
import { MfaRecoveryCodesDisplay } from './mfa-recovery-codes-display';

export interface MfaEnrollmentCardProps {
  otpauthUri: string;
  secret: string;
  recoveryCodes: string[];
  onConfirm: (input: MfaConfirmRequest) => Promise<void>;
  serverError?: unknown;
  isSubmitting?: boolean;
}

export function MfaEnrollmentCard({
  otpauthUri,
  secret,
  recoveryCodes,
  onConfirm,
  serverError,
  isSubmitting,
}: MfaEnrollmentCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // QR rendering failure isn't fatal — the manual secret is shown
        // alongside, so the user can still enroll.
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  const form = useForm<MfaConfirmRequest>({
    resolver: zodResolver(mfaConfirmRequestSchema),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });
  const submitting = isSubmitting || form.formState.isSubmitting;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onConfirm(values);
    } catch {
      // Server error rendered via prop.
    }
  });

  return (
    <section className="flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h2 className="font-sans text-xl font-semibold">Enable two-factor authentication</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Scan the QR code with an authenticator app (1Password, Authy, Google Authenticator) or
          enter the secret manually, then enter the 6-digit code below to confirm.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-start">
        <div
          aria-label="MFA enrollment QR code"
          data-testid="mfa-enrollment-qr"
          className="flex h-48 w-48 shrink-0 items-center justify-center rounded-md border border-border bg-bg"
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Scan with your authenticator app" className="h-44 w-44" />
          ) : (
            <span className="text-xs text-fg-muted">Generating QR…</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Or enter manually
          </p>
          <code
            data-testid="mfa-enrollment-secret"
            className="select-all break-all rounded-md bg-bg p-3 font-mono text-sm text-fg"
          >
            {secret}
          </code>
        </div>
      </div>

      <MfaRecoveryCodesDisplay recoveryCodes={recoveryCodes} />

      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Confirm MFA enrollment"
        className="flex flex-col gap-4"
      >
        {serverError ? <AuthError error={serverError} /> : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="mfa-confirm-code" className="text-sm font-medium text-fg">
            6-digit code from your app
          </label>
          <input
            id="mfa-confirm-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-invalid={form.formState.errors.code ? 'true' : 'false'}
            {...form.register('code')}
            className="h-11 rounded-md border border-border bg-bg px-3 text-sm tracking-widest text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {form.formState.errors.code ? (
            <p className="text-xs text-fg" role="alert">
              {form.formState.errors.code.message}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={submitting}
          data-testid="mfa-confirm-submit"
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Confirming…' : 'Confirm and enable'}
        </button>
      </form>
    </section>
  );
}
