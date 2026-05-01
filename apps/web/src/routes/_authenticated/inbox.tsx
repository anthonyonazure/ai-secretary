/**
 * `/inbox` — landing route for D1 default.
 *
 * Story 1.7 mounts the F2 user-first-launch surface here:
 *   - Empty meetings list → `<EmptyStateRecipient>` (sample library +
 *     import-CTA, co-equal).
 *   - Non-empty list → placeholder list of recent meetings (the full
 *     Inbox UX — Today / My Actions / Recent — is Epic 4 work).
 *
 * The meetings list comes from `GET /api/v1/meetings` via React Query.
 * Cursor-based pagination is wired but only the first page is consumed
 * here; the inbox-pagination work lands later.
 *
 * Story 1.9 — user-facing strings routed through `useT`.
 */

import { type MeetingsListResponse, meetingsListResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Inbox as InboxIcon } from 'lucide-react';
import { EmptyStateRecipient } from '../../components/feature/onboarding/empty-state-recipient';
import { useAuth, useAuthStore } from '../../hooks/use-auth';
import { useT } from '../../i18n/use-t';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';

export const Route = createFileRoute('/_authenticated/inbox')({
  component: InboxRoute,
});

const fetchMeetings = async (accessToken: string | null): Promise<MeetingsListResponse> => {
  const baseUrl = resolveApiBaseUrl();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${baseUrl}/api/v1/meetings?limit=10`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load meetings (${res.status})`);
  }
  const json = (await res.json()) as unknown;
  return meetingsListResponseSchema.parse(json);
};

function InboxRoute() {
  const { user } = useAuth();
  const { t } = useT();
  // Read the access token off the store directly so the query key
  // updates if it rotates mid-session.
  const accessToken = useAuthStore((s) => s.accessToken);

  const meetingsQuery = useQuery({
    queryKey: ['meetings', 'list', user?.id ?? 'anon'],
    queryFn: () => fetchMeetings(accessToken),
    enabled: !!user && !!accessToken,
    staleTime: 30_000,
  });

  if (meetingsQuery.isLoading) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
          >
            <InboxIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="font-sans text-2xl font-semibold">{t('inbox.heading')}</h1>
        </header>
        <output className="text-sm text-fg-muted">{t('inbox.loading')}</output>
      </section>
    );
  }

  if (meetingsQuery.isError) {
    return (
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
          >
            <InboxIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="font-sans text-2xl font-semibold">{t('inbox.heading')}</h1>
        </header>
        <p className="text-sm text-fg" role="alert">
          {t('inbox.error')}
        </p>
      </section>
    );
  }

  const items = meetingsQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <EmptyStateRecipient />
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <InboxIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">{t('inbox.heading')}</h1>
      </header>
      <ul className="flex flex-col gap-3">
        {items.map((meeting) => (
          <li key={meeting.id}>
            <Link
              to="/meetings/$meetingId"
              params={{ meetingId: meeting.id }}
              className="flex flex-col gap-1 rounded-md border border-border bg-bg-elevated p-4 transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid={`inbox-meeting-${meeting.id}`}
            >
              <span className="font-sans text-sm font-medium text-fg">
                {meeting.title || t('inbox.untitledMeeting')}
              </span>
              <span className="text-xs text-fg-muted">
                {meeting.status} · {new Date(meeting.createdAt).toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
