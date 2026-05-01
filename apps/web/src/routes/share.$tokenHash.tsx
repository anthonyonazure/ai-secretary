/**
 * `/share/:tokenHash` — public, no-auth share-token recipient view (FR32).
 *
 * Resolves the share by hashing the URL token (server side) and renders
 * a read-only meeting view with whatever scope the share-creator granted
 * (full meeting / clip / single insight). Expired tokens render a clean
 * "this share has expired" page with a "request new link" CTA.
 *
 * No auth required — the token is the credential.
 */

import { type RecipientViewResponse, recipientViewResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { Clock, Mail } from 'lucide-react';
import { resolveApiBaseUrl } from '../lib/auth/api-client';

export const Route = createFileRoute('/share/$tokenHash')({
  component: ShareTokenRoute,
});

const fetchShare = async (tokenHash: string): Promise<RecipientViewResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/share/${encodeURIComponent(tokenHash)}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 410) {
    throw new Error('expired');
  }
  if (res.status === 403) {
    throw new Error('blocked');
  }
  if (!res.ok) {
    throw new Error(`Failed to load share (${res.status})`);
  }
  return recipientViewResponseSchema.parse(await res.json());
};

function ShareTokenRoute() {
  const { tokenHash } = useParams({ from: '/share/$tokenHash' });
  const shareQuery = useQuery({
    queryKey: ['share', tokenHash],
    queryFn: () => fetchShare(tokenHash),
    retry: false,
    staleTime: 60_000,
  });

  if (shareQuery.isLoading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-6 py-16">
        <output className="text-sm text-fg-muted">Loading share…</output>
      </main>
    );
  }

  if (shareQuery.isError) {
    const reason = shareQuery.error?.message;
    if (reason === 'expired') {
      return <ExpiredView />;
    }
    if (reason === 'blocked') {
      return <BlockedView />;
    }
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="font-sans text-2xl font-semibold">Share unavailable</h1>
        <p className="text-sm text-fg-muted">
          We couldn’t load this share. The link may be invalid or the resource may have been
          removed.
        </p>
      </main>
    );
  }

  const data = shareQuery.data;
  if (!data) return null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-fg-muted">
          Shared meeting · {data.kind}
        </span>
        <h1 className="font-sans text-2xl font-semibold">{data.meeting.title}</h1>
        {data.meeting.recordedAt ? (
          <p className="text-xs text-fg-muted">
            Recorded {new Date(data.meeting.recordedAt).toLocaleString()}
          </p>
        ) : null}
      </header>

      {data.moduleOutputs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Analysis</h2>
          {data.moduleOutputs.map((output, idx) => (
            <article
              key={`${output.moduleId}-${idx}`}
              className="rounded-md border border-border bg-surface p-4"
              data-testid={`share-module-${idx}`}
            >
              <pre className="overflow-x-auto font-mono text-xs text-fg-muted">
                {JSON.stringify(output, null, 2)}
              </pre>
            </article>
          ))}
        </section>
      ) : null}

      {data.speakerTurns.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Transcript
          </h2>
          <ol className="flex flex-col gap-3">
            {data.speakerTurns.map((turn) => (
              <li
                key={turn.turnId}
                className="rounded-md border border-border bg-surface p-3"
                data-testid={`share-turn-${turn.turnId}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-fg-muted">
                    {Math.floor(turn.spanStartMs / 1000)}s
                  </span>
                  <span className="text-xs font-medium text-fg">{turn.speaker ?? 'Speaker'}</span>
                </div>
                <p className="text-sm text-fg">{turn.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="border-border border-t pt-4 text-xs text-fg-muted">
        This is a read-only share. Sign up at aisecretary.app to start your own meeting library.
      </footer>
    </main>
  );
}

function ExpiredView() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-warning-soft text-fg"
      >
        <Clock className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="font-sans text-2xl font-semibold">This share has expired</h1>
      <p className="text-sm text-fg-muted">
        The link you followed is no longer active. Reach out to the person who shared it for a new
        link.
      </p>
      <a
        href="mailto:?subject=Could%20you%20resend%20the%20share%20link%3F"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-accent-soft"
        data-testid="share-expired-cta"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Request a new link
      </a>
    </main>
  );
}

function BlockedView() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="font-sans text-2xl font-semibold">Blocked by your organization</h1>
      <p className="text-sm text-fg-muted">
        Your organization’s policy prevents viewing shares from external tenants. Ask your admin to
        allow this sender, or open the link in a personal browser session.
      </p>
    </main>
  );
}
