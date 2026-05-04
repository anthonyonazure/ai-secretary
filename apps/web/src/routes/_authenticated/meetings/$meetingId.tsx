/**
 * `/meetings/:meetingId` — meeting detail view.
 *
 * Mirrors the mobile shape (`apps/mobile/app/meetings/[meetingId].tsx`):
 * tabbed navigation (receipt | transcript | analysis | actions | shares
 * | audit) driven by `deriveMeetingDetailTabs`. Tabs reveal as data
 * lands — the brand-new meeting shows just `receipt` until the
 * transcript + analysis pipeline finishes.
 *
 * Data sources:
 *   - transcript: `useSpeakerTurns(meetingId)` → GET /meetings/:id/speaker-turns
 *   - actions:    `fetchActionItems({ meetingId })` → GET /action-items?meetingId=:id
 *   - analysis / shares / audit: placeholder copy for now (the per-tab
 *     content lands in subsequent stories).
 *
 * `<FirstReceiptPolish>` wraps the receipt-tab content so the first 3
 * receipts get the celebration animation; the 4th+ falls through to
 * the calm default automatically (Story 1.7).
 */

import type { ListActionItemsResponse } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useSpeakerTurns } from '../../../components/feature/analysis/use-speaker-turns';
import { FirstReceiptPolish } from '../../../components/feature/onboarding/first-receipt-polish';
import { useAuth, useAuthStore } from '../../../hooks/use-auth';
import {
  type MeetingDetailTab,
  deriveMeetingDetailTabs,
} from '../../../hooks/use-meeting-detail-tabs';
import { fetchActionItems } from '../../../lib/action-items/api-client';

const TAB_LABELS: Record<MeetingDetailTab, string> = {
  receipt: 'Receipt',
  transcript: 'Transcript',
  analysis: 'Analysis',
  actions: 'Actions',
  shares: 'Shares',
  audit: 'Audit',
};

export const Route = createFileRoute('/_authenticated/meetings/$meetingId')({
  component: MeetingDetailRoute,
});

function MeetingDetailRoute() {
  const { meetingId } = Route.useParams();
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'org_admin';

  const turnsQuery = useSpeakerTurns(meetingId);
  const actionItemsQuery = useQuery<ListActionItemsResponse>({
    queryKey: ['meeting-action-items', meetingId, user?.id ?? 'anon'],
    queryFn: () => fetchActionItems(accessToken, { meetingId, limit: 50 }),
    enabled: !!meetingId && !!user && !!accessToken,
    staleTime: 30_000,
  });

  const turns = turnsQuery.turns;
  const actionItems = actionItemsQuery.data?.items ?? [];

  const tabs = useMemo(
    () =>
      deriveMeetingDetailTabs({
        hasTranscript: turns.length > 0,
        hasAnalysis: false,
        actionItemCount: actionItems.length,
        shareCount: 0,
        isAdmin,
      }),
    [turns.length, actionItems.length, isAdmin],
  );
  const [activeTab, setActiveTab] = useState<MeetingDetailTab>(tabs.defaultTab);
  const visibleTab: MeetingDetailTab = tabs.visibleTabs.includes(activeTab)
    ? activeTab
    : tabs.defaultTab;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
      <header>
        <h1 className="font-sans text-2xl font-semibold">Meeting</h1>
        <p className="mt-1 font-mono text-xs text-fg-muted" data-testid="meeting-id-display">
          {meetingId}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Meeting sections"
        className="-mx-1 flex flex-wrap gap-1 border-border border-b pb-2"
      >
        {tabs.visibleTabs.map((tab) => {
          const active = visibleTab === tab;
          const badge = tabs.badges[tab];
          return (
            <button
              type="button"
              key={tab}
              role="tab"
              aria-selected={active}
              data-testid={`meeting-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-accent-soft font-semibold text-fg'
                  : 'bg-transparent text-fg-muted hover:text-fg'
              }`}
            >
              <span>{TAB_LABELS[tab]}</span>
              {badge !== null ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-bg">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={TAB_LABELS[visibleTab]}>
        {visibleTab === 'receipt' ? (
          <FirstReceiptPolish meetingId={meetingId}>
            <div
              className="rounded-md border border-border bg-surface p-4 text-sm text-fg"
              data-testid="meeting-receipt-panel"
            >
              Summary lands here once analysis completes.
            </div>
          </FirstReceiptPolish>
        ) : visibleTab === 'transcript' ? (
          <TranscriptPanel
            isLoading={turnsQuery.isLoading}
            isError={turnsQuery.isError}
            turns={turns}
          />
        ) : visibleTab === 'actions' ? (
          <ActionItemsPanel isLoading={actionItemsQuery.isLoading} items={actionItems} />
        ) : visibleTab === 'analysis' ? (
          <p className="text-base text-fg-muted">Module-specific analysis lands here.</p>
        ) : visibleTab === 'shares' ? (
          <p className="text-base text-fg-muted">Shares + recipients land here.</p>
        ) : (
          <p className="text-base text-fg-muted">Audit log slice for admins.</p>
        )}
      </div>
    </section>
  );
}

interface TranscriptPanelProps {
  isLoading: boolean;
  isError: boolean;
  turns: ReturnType<typeof useSpeakerTurns>['turns'];
}

function TranscriptPanel({ isLoading, isError, turns }: TranscriptPanelProps) {
  if (isLoading) {
    return <output className="text-fg-muted">Loading transcript…</output>;
  }
  if (isError) {
    return (
      <p className="text-fg" role="alert">
        Couldn't load transcript.
      </p>
    );
  }
  if (turns.length === 0) {
    return <p className="text-fg-muted">Transcript not yet available.</p>;
  }
  return (
    <ol className="flex flex-col gap-3" data-testid="meeting-transcript-list">
      {turns.map((turn) => (
        <li
          key={turn.turnId}
          className="rounded-md border border-border bg-surface p-3"
          data-testid={`turn-${turn.turnId}`}
        >
          <p className="mb-1 text-xs text-fg-muted">
            {turn.speaker ?? 'Speaker'} · {Math.floor(turn.spanStartMs / 1000)}s
          </p>
          <p className="text-sm text-fg">{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

interface ActionItemsPanelProps {
  isLoading: boolean;
  items: ListActionItemsResponse['items'];
}

function ActionItemsPanel({ isLoading, items }: ActionItemsPanelProps) {
  if (isLoading) {
    return <output className="text-fg-muted">Loading action items…</output>;
  }
  if (items.length === 0) {
    return <p className="text-fg-muted">No action items extracted yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-2" data-testid="meeting-action-items-list">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-md border border-border bg-surface p-3"
          data-testid={`meeting-action-${item.id}`}
        >
          <p className="text-sm text-fg">{item.text}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : 'No due date'} ·{' '}
            {item.status}
          </p>
        </li>
      ))}
    </ol>
  );
}
