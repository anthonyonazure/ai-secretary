/**
 * `/search` — full-text search results page (Story 7.2).
 *
 * Wires `GET /api/v1/search?q=<query>&limit=20`. Renders ranked snippets
 * with `<mark>` highlighting and deep-links to citation anchors via the
 * `(meetingId, turnId)` contract.
 */

import { type SearchResponse, searchResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth, useAuthStore } from '../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';

export const Route = createFileRoute('/_authenticated/search')({
  component: SearchRoute,
});

const fetchSearch = async (q: string, accessToken: string | null): Promise<SearchResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const baseUrl = resolveApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/search?q=${encodeURIComponent(q)}&limit=20`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return searchResponseSchema.parse(await res.json());
};

function SearchRoute() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const inputId = useId();

  const searchQuery = useQuery({
    queryKey: ['search', submitted, user?.id ?? 'anon'],
    queryFn: () => fetchSearch(submitted, accessToken),
    enabled: submitted.length >= 2 && !!user && !!accessToken,
    staleTime: 30_000,
  });

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Search</h1>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Search
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meetings, transcripts, summaries…"
          className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="search-input"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={query.trim().length < 2}
          data-testid="search-submit"
        >
          Search
        </button>
      </form>

      <output aria-live="polite" className="text-sm text-fg-muted">
        {searchQuery.isFetching
          ? 'Searching…'
          : searchQuery.data
            ? `${searchQuery.data.totalCount} result${
                searchQuery.data.totalCount === 1 ? '' : 's'
              } · ${searchQuery.data.durationMs}ms`
            : ''}
      </output>

      {searchQuery.isError ? (
        <p role="alert" className="text-sm text-danger">
          Search is temporarily unavailable.
        </p>
      ) : null}

      {searchQuery.data?.items.length === 0 && submitted.length >= 2 ? (
        <p className="text-sm text-fg-muted" data-testid="search-empty">
          No matches for “{submitted}.” Try different keywords or a phrase.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {(searchQuery.data?.items ?? []).map((hit, idx) => (
          <li key={`${hit.meetingId}-${hit.turnId ?? idx}`}>
            <Link
              to="/meetings/$meetingId"
              params={{ meetingId: hit.meetingId }}
              className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4 transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid={`search-result-${idx}`}
            >
              <span className="flex items-center gap-2">
                <span className="font-sans text-sm font-medium text-fg">{hit.meetingTitle}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
                  {hit.source}
                </span>
              </span>
              <span
                className="text-xs text-fg-muted"
                /*
                 * Server returns sanitized markup with <mark> wrappers
                 * around matched terms; safe to render via dangerouslySet
                 * because the API hand-builds with allowlisted tags only.
                 */
                // biome-ignore lint/security/noDangerouslySetInnerHtml: server-sanitized snippet
                dangerouslySetInnerHTML={{ __html: hit.snippet }}
              />
              {hit.spanStartMs !== null ? (
                <span className="text-[10px] font-mono text-fg-muted">
                  @ {Math.floor(hit.spanStartMs / 1000)}s{hit.speaker ? ` · ${hit.speaker}` : ''}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
