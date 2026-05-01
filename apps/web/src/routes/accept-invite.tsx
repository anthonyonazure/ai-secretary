/**
 * `/accept-invite` — public route. Story 1.5d.
 *
 * URL shape: `/accept-invite?token=<plaintext-token>`. Performs a
 * server-side lookup for invite metadata, then renders
 * `<AcceptInviteForm>`. On submit success the auth store gets the new
 * session (via `useAcceptInvite`'s onSuccess) and we navigate to
 * `/inbox`.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AcceptInviteForm } from '../components/feature/invites/accept-invite-form';
import { useAcceptInvite, useInviteLookup } from '../hooks/use-invites';

export interface AcceptInviteSearch {
  token?: string;
}

const validateSearch = (search: Record<string, unknown>): AcceptInviteSearch => {
  const token = search.token;
  return typeof token === 'string' && token.length > 0 ? { token } : {};
};

export const Route = createFileRoute('/accept-invite')({
  validateSearch,
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const lookup = useInviteLookup(token);
  const acceptMutation = useAcceptInvite();
  const [serverError, setServerError] = useState<unknown>(null);

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-6">
          <h1 className="font-sans text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-fg-muted">
            This URL is missing an invite token. Ask your admin to send a fresh invite.
          </p>
        </div>
      </main>
    );
  }

  if (lookup.isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
        <p className="text-sm text-fg-muted">Loading your invite…</p>
      </main>
    );
  }

  if (lookup.isError || !lookup.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-6">
          <h1 className="font-sans text-xl font-semibold">This invite is no longer valid</h1>
          <p className="text-sm text-fg-muted">
            It may have expired, been revoked, or already been accepted. Ask your admin to send a
            fresh invite.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-fg">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-sans text-2xl font-semibold">Accept your invite</h1>
          <p className="text-sm text-fg-muted">Set a password and you're in.</p>
        </header>
        <AcceptInviteForm
          lookup={lookup.data}
          token={token}
          serverError={serverError}
          isSubmitting={acceptMutation.isPending}
          onSubmit={async (values) => {
            setServerError(null);
            try {
              await acceptMutation.mutateAsync(values);
              await navigate({ to: '/inbox' });
            } catch (err) {
              setServerError(err);
              throw err;
            }
          }}
        />
      </div>
    </main>
  );
}
