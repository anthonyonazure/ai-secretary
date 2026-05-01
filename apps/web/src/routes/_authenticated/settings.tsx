/**
 * `/settings` — placeholder. Real settings (profile, MFA, region,
 * org-level controls) land in dedicated stories.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useShellModeStore } from '../../components/layout/shell-mode-store';
import { useAuth } from '../../hooks/use-auth';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { user, logout } = useAuth();
  const mode = useShellModeStore((s) => s.mode);
  const setMode = useShellModeStore((s) => s.setMode);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-sans text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">Account + experience preferences.</p>
      </header>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="font-sans text-sm font-semibold">Account</h2>
        <p className="mt-1 text-sm text-fg-muted">{user?.email ?? 'No user signed in'}</p>
        <button
          type="button"
          onClick={() => {
            void logout();
          }}
          className="mt-3 inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="font-sans text-sm font-semibold">App shell</h2>
        <p className="mt-1 text-sm text-fg-muted">
          {/* TODO(future Story): replace with tenant.mode field on tenants table. */}
          Choose between the org-context inbox shell (D1) and the single-user card feed (D3).
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('inbox')}
            data-active={mode === 'inbox' ? 'true' : 'false'}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft data-[active=true]:bg-accent-soft data-[active=true]:font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            Inbox (D1)
          </button>
          <button
            type="button"
            onClick={() => setMode('cards')}
            data-active={mode === 'cards' ? 'true' : 'false'}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft data-[active=true]:bg-accent-soft data-[active=true]:font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            Cards (D3)
          </button>
        </div>
      </div>
    </section>
  );
}
