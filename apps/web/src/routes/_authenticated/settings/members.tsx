/**
 * `/settings/members` — Story 1.5d.
 *
 * Admin-only surface that lists pending + historical invites and lets
 * an `org_admin` (or `super_admin`) create/revoke. The route exists
 * inside `_authenticated`, so unauthenticated visits redirect to
 * `/login`. A non-admin who reaches this URL sees the empty state +
 * a "permission required" banner — the API blocks state-changing
 * operations regardless.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { InviteCreateForm } from '../../../components/feature/invites/invite-create-form';
import { InviteList } from '../../../components/feature/invites/invite-list';
import { useAuth } from '../../../hooks/use-auth';
import { useCreateInvite, useInvitesList, useRevokeInvite } from '../../../hooks/use-invites';

export const Route = createFileRoute('/_authenticated/settings/members')({
  component: MembersRoute,
});

function MembersRoute() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const isAdmin = user?.role === 'org_admin' || user?.role === 'super_admin';

  const list = useInvitesList(tenantId);
  const create = useCreateInvite(tenantId);
  const revoke = useRevokeInvite(tenantId);
  const [serverError, setServerError] = useState<unknown>(null);

  if (!isAdmin) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
        <header>
          <h1 className="font-sans text-2xl font-semibold">Members</h1>
        </header>
        <p
          role="alert"
          className="rounded-md border border-border bg-surface p-4 text-sm text-fg-muted"
        >
          Inviting members is admin-only. Ask an org admin to add new teammates.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold">Members</h1>
        <p className="text-sm text-fg-muted">Invite teammates and manage pending invites.</p>
      </header>

      <InviteCreateForm
        serverError={serverError}
        isSubmitting={create.isPending}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            await create.mutateAsync(values);
          } catch (err) {
            setServerError(err);
            throw err;
          }
        }}
      />

      {list.isLoading ? (
        <p className="text-sm text-fg-muted">Loading invites…</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-fg">
          Could not load invites. Please refresh.
        </p>
      ) : (
        <InviteList
          invites={list.data?.items ?? []}
          isRevoking={revoke.isPending}
          onRevoke={async (id) => {
            await revoke.mutateAsync(id);
          }}
        />
      )}
    </section>
  );
}
