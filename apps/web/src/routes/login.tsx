/**
 * `/login` — TanStack Router file route.
 *
 * Story 1.5a embedded the email/password form. Story 1.5c extends:
 * if `/login` returns `kind: 'mfa-required'`, the route stays mounted
 * and swaps to the MFA challenge form without navigating. On verify
 * success the user lands on `/inbox`. If the challenge response signals
 * `enrollmentRequired`, we redirect to `/settings/security` with a
 * banner so the user enrols before a session is issued.
 *
 * Story 1.9 — heading + subheading routed through `useT`.
 */

import type { MfaChallengeResponse, VerifyMfaRequest } from '@aisecretary/shared/schemas/auth';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { LoginForm } from '../components/feature/auth/login-form';
import { MfaChallengeForm } from '../components/feature/auth/mfa-challenge-form';
import { useAuth } from '../hooks/use-auth';
import { useT } from '../i18n/use-t';

export interface LoginSearch {
  redirect?: string;
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const redirectRaw = search.redirect;
    const redirectValue = typeof redirectRaw === 'string' ? redirectRaw : undefined;
    return redirectValue !== undefined ? { redirect: redirectValue } : {};
  },
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const navigate = useNavigate();
  const { login, verifyMfa } = useAuth();
  const { t } = useT();
  const [serverError, setServerError] = useState<unknown>(null);
  const [challenge, setChallenge] = useState<MfaChallengeResponse | null>(null);

  const heading = challenge ? t('auth.login.heading.mfa') : t('auth.login.heading');
  const subheading = challenge
    ? challenge.enrollmentRequired
      ? t('auth.login.subheading.mfa.enrollmentRequired')
      : t('auth.login.subheading.mfa')
    : t('auth.login.subheading');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-sans text-2xl font-semibold">{heading}</h1>
          <p className="text-sm text-fg-muted">{subheading}</p>
        </header>

        {challenge ? (
          <MfaChallengeForm
            challengeToken={challenge.challengeToken}
            hideRecoveryToggle={challenge.enrollmentRequired}
            serverError={serverError}
            onSubmit={async (values: VerifyMfaRequest) => {
              setServerError(null);
              try {
                if (challenge.enrollmentRequired) {
                  // Force-enroll path: don't even hit verify-mfa.
                  // Send the user to enrollment; verify-mfa would 401.
                  await navigate({ to: '/settings/security' });
                  return;
                }
                const response = await verifyMfa(values);
                if (response.kind === 'session') {
                  await navigate({ to: '/inbox' });
                }
              } catch (err) {
                setServerError(err);
                throw err;
              }
            }}
          />
        ) : (
          <LoginForm
            onSubmit={async (values) => {
              setServerError(null);
              try {
                const response = await login(values);
                if (response.kind === 'mfa-required') {
                  setChallenge(response);
                  return;
                }
                await navigate({ to: '/inbox' });
              } catch (err) {
                setServerError(err);
                throw err;
              }
            }}
            serverError={serverError}
            onSwitchToSignup={() => {
              void navigate({ to: '/signup' });
            }}
          />
        )}
      </div>
    </main>
  );
}
