/**
 * Root route — Story 1.6.
 *
 * Hosts the `<Outlet />` for everything below. The TanStack Router
 * Devtools are mounted in dev only; production bundles tree-shake the
 * import via the `import.meta.env.DEV` guard.
 *
 * The auth-context shape registered with the router lives here too so
 * `beforeLoad` in `_authenticated.tsx` can type-check against it.
 */

import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
}
