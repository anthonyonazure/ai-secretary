/**
 * `/lti/launch` — LTI 1.3 deep-link launch landing page (FR35).
 *
 * The LMS POSTs an `id_token` here on deep-link launch. The server
 * validates the JWT (issuer, audience, nonce, kid), creates a
 * short-lived session, and redirects the user to the linked meeting
 * resource.
 *
 * This client view is what the user sees during the brief redirect
 * window — minimal, accessible, and reassuring. No AI Secretary
 * branding hammered: this is shown inside an LMS iframe.
 */

import { createFileRoute } from '@tanstack/react-router';
import { GraduationCap } from 'lucide-react';

export const Route = createFileRoute('/lti/launch')({
  component: LtiLaunchRoute,
});

function LtiLaunchRoute() {
  return (
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      data-testid="lti-launch-landing"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-fg"
      >
        <GraduationCap className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="font-sans text-xl font-semibold">Opening AI Secretary…</h1>
      <p className="text-sm text-fg-muted">
        Verifying your LMS launch and loading the linked resource. If this page doesn’t advance, try
        the LMS link again.
      </p>
      <output aria-live="polite" className="text-xs text-fg-muted">
        Verifying token…
      </output>
    </main>
  );
}
