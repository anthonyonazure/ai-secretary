/**
 * `/actions` — My Actions cross-meeting roll-up (Story 8.5).
 *
 * Lists every open action item across all of the user's meetings with
 * one-tap mark-done. Status filter defaults to "open" (pending +
 * accepted); a small toggle row exposes "all" + "done".
 */

import type { ActionItemStatus } from '@aisecretary/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ListChecks } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ActionItemCard } from '../../components/feature/action-items/action-item-card';
import { useAuth, useAuthStore } from '../../hooks/use-auth';
import { fetchActionItems, updateActionItemStatus } from '../../lib/action-items/api-client';

export const Route = createFileRoute('/_authenticated/actions')({
  component: MyActionsRoute,
});

type FilterTab = 'open' | 'done' | 'all';

const FILTER_TO_STATUSES: Record<FilterTab, ActionItemStatus[] | undefined> = {
  open: ['pending', 'accepted'],
  done: ['done'],
  all: undefined,
};

const TABS: ReadonlyArray<{ id: FilterTab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

function MyActionsRoute() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('open');

  const statuses = FILTER_TO_STATUSES[filter];
  const queryKey = ['action-items', user?.id ?? 'anon', filter];

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchActionItems(accessToken, statuses ? { status: statuses, limit: 50 } : { limit: 50 }),
    enabled: !!user && !!accessToken,
    staleTime: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionItemStatus }) =>
      updateActionItemStatus(accessToken, id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
  });

  const handleUpdate = useCallback(
    (id: string, status: ActionItemStatus) => {
      updateMutation.mutate({ id, status });
    },
    [updateMutation],
  );

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">My Actions</h1>
      </header>

      <div role="tablist" aria-label="Action item filter" className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            data-active={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-fg-muted hover:text-fg data-[active=true]:bg-accent-soft data-[active=true]:text-fg data-[active=true]:font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <output className="text-sm text-fg-muted">Loading your actions…</output>
      ) : listQuery.isError ? (
        <p role="alert" className="text-sm text-fg">
          We couldn't load your actions. Please try again.
        </p>
      ) : !listQuery.data || listQuery.data.items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          {filter === 'open'
            ? 'You have no open actions. Nice work.'
            : filter === 'done'
              ? 'No completed actions yet.'
              : 'No action items yet — record a meeting to see commitments roll up here.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="action-items-list">
          {listQuery.data.items.map((item) => (
            <ActionItemCard
              key={item.id}
              item={item}
              isPending={updateMutation.isPending && updateMutation.variables?.id === item.id}
              onUpdateStatus={handleUpdate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
