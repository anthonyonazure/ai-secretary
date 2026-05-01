/**
 * `/meetings/:meetingId` — placeholder showing an `AnalysisCard` demo
 * so the route surface is reachable end-to-end. Story 3.x replaces
 * this placeholder with the real meeting detail view.
 *
 * Story 1.7 wraps the AnalysisCard in `<FirstReceiptPolish>` so the
 * first three receipts get celebration animation + thumbs prompt; the
 * 4th+ falls back to the calm default automatically.
 */

import { createFileRoute } from '@tanstack/react-router';
import { AnalysisCard } from '../../../components/feature/analysis/analysis-card';
import { FirstReceiptPolish } from '../../../components/feature/onboarding/first-receipt-polish';

export const Route = createFileRoute('/_authenticated/meetings/$meetingId')({
  component: MeetingDetailRoute,
});

function MeetingDetailRoute() {
  const { meetingId } = Route.useParams();

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
      <header>
        <h1 className="font-sans text-2xl font-semibold">Meeting</h1>
        <p className="mt-1 font-mono text-xs text-fg-muted">{meetingId}</p>
      </header>
      <FirstReceiptPolish meetingId={meetingId}>
        <AnalysisCard
          module="general"
          state={{
            kind: 'ready',
            output: {
              module: 'general',
              title: 'Quick read',
              summary:
                'Placeholder analysis. Real meeting analysis lands once the receipt-stream lifecycle is wired end-to-end.',
              bullets: [
                {
                  claim: 'This is a route stub. The meeting detail view ships in a later story.',
                  citations: [],
                },
              ],
            },
          }}
        />
      </FirstReceiptPolish>
    </section>
  );
}
