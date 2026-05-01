/**
 * 404 / not-found splat route. TanStack Router routes to this when no
 * other file route matches. Renders a minimal page with a link back
 * to the inbox so users aren't trapped.
 */

import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/404')({
  component: NotFoundRoute,
});

function NotFoundRoute() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-fg">
      <h1 className="font-sans text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-fg-muted">
        We couldn't find that page. It may have moved or been deleted.
      </p>
      <Link
        to="/inbox"
        className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        Back to inbox
      </Link>
    </main>
  );
}
