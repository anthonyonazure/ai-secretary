/**
 * `/settings/security` — Story 1.5c.
 *
 * MFA enrollment + disable + recovery-code regenerate UI. The route
 * lives under `_authenticated`, so unauthenticated visits redirect to
 * `/login`. The page has three states:
 *   1. Not enrolled              → "Enable" button → enrollment card
 *   2. Pending (post-enroll)     → enrollment card with QR / secret / codes
 *   3. Enabled                   → disable + regenerate-codes controls
 */

import type { MfaEnrollResponse } from '@aisecretary/shared/schemas/auth';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { MfaEnrollmentCard } from '../../../components/feature/auth/mfa-enrollment-card';
import { MfaRecoveryCodesDisplay } from '../../../components/feature/auth/mfa-recovery-codes-display';
import { useAuth } from '../../../hooks/use-auth';

export const Route = createFileRoute('/_authenticated/settings/security')({
  component: SecurityRoute,
});

type FlowState =
  | { kind: 'idle' }
  | { kind: 'enrolling'; enrollment: MfaEnrollResponse }
  | { kind: 'enabled' }
  | { kind: 'regenerated'; recoveryCodes: string[] };

function SecurityRoute() {
  const {
    user,
    enrollMfa,
    confirmMfa,
    disableMfa,
    regenerateRecoveryCodes,
    confirmMfaError,
    disableMfaError,
    regenerateRecoveryCodesError,
  } = useAuth();

  const initial: FlowState = user?.isMfaEnabled ? { kind: 'enabled' } : { kind: 'idle' };
  const [state, setState] = useState<FlowState>(initial);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-sans text-2xl font-semibold">Security</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Manage multi-factor authentication for your account.
        </p>
      </header>

      {state.kind === 'idle' ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <h2 className="font-sans text-sm font-semibold">Two-factor authentication</h2>
          <p className="text-sm text-fg-muted">
            Add an authenticator app for an extra layer of security.
          </p>
          <button
            type="button"
            onClick={async () => {
              const enrollment = await enrollMfa();
              setState({ kind: 'enrolling', enrollment });
            }}
            data-testid="mfa-enroll-start"
            className="inline-flex h-9 w-fit items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            Enable two-factor authentication
          </button>
        </div>
      ) : null}

      {state.kind === 'enrolling' ? (
        <MfaEnrollmentCard
          otpauthUri={state.enrollment.otpauthUri}
          secret={state.enrollment.secret}
          recoveryCodes={state.enrollment.recoveryCodes}
          serverError={confirmMfaError}
          onConfirm={async ({ code }) => {
            await confirmMfa({ code });
            setState({ kind: 'enabled' });
          }}
        />
      ) : null}

      {state.kind === 'enabled' ? (
        <ManageEnabledMfa
          onDisable={async (password, code) => {
            await disableMfa({ password, code });
            setState({ kind: 'idle' });
          }}
          onRegenerate={async (password, code) => {
            const fresh = await regenerateRecoveryCodes({ password, code });
            setState({ kind: 'regenerated', recoveryCodes: fresh.recoveryCodes });
          }}
          disableError={disableMfaError}
          regenerateError={regenerateRecoveryCodesError}
        />
      ) : null}

      {state.kind === 'regenerated' ? (
        <MfaRecoveryCodesDisplay
          recoveryCodes={state.recoveryCodes}
          onAcknowledge={() => setState({ kind: 'enabled' })}
        />
      ) : null}
    </section>
  );
}

function ManageEnabledMfa({
  onDisable,
  onRegenerate,
  disableError,
  regenerateError,
}: {
  onDisable: (password: string, code: string) => Promise<void>;
  onRegenerate: (password: string, code: string) => Promise<void>;
  disableError: unknown;
  regenerateError: unknown;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'disable' | 'regenerate' | null>(null);

  return (
    <div
      data-testid="mfa-manage-enabled"
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <h2 className="font-sans text-sm font-semibold">Two-factor authentication is enabled</h2>
      <p className="text-sm text-fg-muted">
        To disable MFA or regenerate your recovery codes, re-enter your password and a current
        authenticator code.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg">Authenticator code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-11 rounded-md border border-border bg-bg px-3 text-sm tracking-widest text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy('regenerate');
            try {
              await onRegenerate(password, code);
              setPassword('');
              setCode('');
            } finally {
              setBusy(null);
            }
          }}
          data-testid="mfa-regenerate-codes"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-60"
        >
          Regenerate recovery codes
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy('disable');
            try {
              await onDisable(password, code);
            } finally {
              setBusy(null);
            }
          }}
          data-testid="mfa-disable"
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-60"
        >
          Disable two-factor authentication
        </button>
      </div>
      {disableError ? (
        <p role="alert" className="text-sm text-fg">
          Failed to disable MFA — check your password and code.
        </p>
      ) : null}
      {regenerateError ? (
        <p role="alert" className="text-sm text-fg">
          Failed to regenerate codes — check your password and code.
        </p>
      ) : null}
    </div>
  );
}
