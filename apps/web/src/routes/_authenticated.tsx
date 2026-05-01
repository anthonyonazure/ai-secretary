/**
 * Authenticated layout route — Story 1.6.
 *
 * Pathless layout (`_authenticated`) — child routes use the URL of
 * their own segment (e.g. `_authenticated/inbox.tsx` → `/inbox`). The
 * `beforeLoad` guard reads the auth store directly via
 * `useAuthStore.getState()` (no React-hook context), redirecting to
 * `/login` if no user is present. Once the redirect lands, the user
 * can sign in and TanStack Router preserves the original location via
 * the `redirect` search param so post-login we can deep-link back to
 * the page they wanted.
 *
 * This layout also chooses the active app shell via `AppShellFrame`,
 * which inspects `useShellMode()` and renders either `AppShell.Inbox`
 * (D1, default) or `AppShell.Cards` (D3, single-user). Both shells
 * mount an `<Outlet />` so the route tree below this layer renders
 * inside the chosen shell.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { AppShellFrame } from '../components/layout/app-shell-frame';
import { useAuthStore } from '../hooks/use-auth';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    // The auth store is hydrated once on first render of `useAuth()`
    // — until that completes the user is `null`, so a hard route load
    // before hydration would erroneously redirect. The router is
    // mounted inside the React tree, so by the time `beforeLoad`
    // fires the in-memory auth store has either:
    //   - Picked up a refresh token from localStorage and exchanged it
    //     for a session (user populated), or
    //   - Failed silently and left user as null (correctly logged out).
    // In dev, the StrictMode double-invoke can race the redirect; the
    // route-level guard re-checks on every navigation so a transient
    // miss self-corrects on the next click.
    const state = useAuthStore.getState();
    if (state.user === null || state.accessToken === null) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayoutComponent,
});

function AuthenticatedLayoutComponent() {
  // `AppShellFrame` mounts the chosen shell (`AppShell.Inbox` |
  // `AppShell.Cards`) and the shell mounts the route `<Outlet />`
  // itself, so this layout doesn't render one directly.
  return <AppShellFrame />;
}
