/**
 * `/signup` — TanStack Router file route. Embeds the Story 1.5a
 * `SignupForm`; on success the new user lands on `/inbox`.
 *
 * Story 1.9 — heading + subheading routed through `useT`.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { SignupForm } from '../components/feature/auth/signup-form';
import { useAuth } from '../hooks/use-auth';
import { useT } from '../i18n/use-t';

export const Route = createFileRoute('/signup')({
  component: SignupRouteComponent,
});

function SignupRouteComponent() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { t } = useT();
  const [serverError, setServerError] = useState<unknown>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-sans text-2xl font-semibold">{t('auth.signup.heading')}</h1>
          <p className="text-sm text-fg-muted">{t('auth.signup.subheading')}</p>
        </header>
        <SignupForm
          onSubmit={async (values) => {
            setServerError(null);
            try {
              await signup(values);
              await navigate({ to: '/inbox' });
            } catch (err) {
              setServerError(err);
              throw err;
            }
          }}
          serverError={serverError}
          onSwitchToLogin={() => {
            void navigate({ to: '/login' });
          }}
        />
      </div>
    </main>
  );
}
