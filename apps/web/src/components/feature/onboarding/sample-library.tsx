/**
 * `SampleLibrary` — Story 1.7.
 *
 * Three placeholder sample meetings (sales call / 1:1 / standup) the
 * brand-new user can click to "try" without recording anything. Per
 * UX spec § F2 user first-launch flow, the sample library is co-equal
 * to "import existing audio" — both paths deliver the user to the
 * receipt loop without their having to record a real meeting.
 *
 * Implementation choice: each card navigates to
 * `/meetings/<sample-meetingId>`. The actual sample-meeting fixtures
 * land in a follow-up (designer brief + content). Until then, the
 * route handler renders the placeholder receipt — enough for the
 * polish surface to fire and for activation telemetry to start
 * flowing.
 *
 * Illustrations are a deliberate `null` until the designer brief
 * lands (UX spec § Designer Brief — three hand-drawn empty-state
 * illustrations). Component skeleton works without them.
 */

import { Link } from '@tanstack/react-router';
import { Briefcase, MessageCircle, Users } from 'lucide-react';

interface SampleMeeting {
  id: string;
  title: string;
  description: string;
  icon: typeof Briefcase;
}

const SAMPLES: SampleMeeting[] = [
  {
    id: 'sample-sales-call',
    title: 'Sales discovery call',
    description: 'See how AI Secretary turns a 30-minute call into a deal card.',
    icon: Briefcase,
  },
  {
    id: 'sample-one-on-one',
    title: 'Manager 1:1',
    description: 'Notes, follow-ups, and an action-item digest — all auto-extracted.',
    icon: MessageCircle,
  },
  {
    id: 'sample-standup',
    title: 'Team standup',
    description: 'Status by participant + a single-paragraph summary.',
    icon: Users,
  },
];

export function SampleLibrary() {
  return (
    <section
      aria-labelledby="sample-library-heading"
      className="flex flex-col gap-3"
      data-testid="sample-library"
    >
      <h2 id="sample-library-heading" className="font-sans text-base font-semibold text-fg">
        Try a sample meeting
      </h2>
      <p className="text-sm text-fg-muted">
        Synthetic content only — no real recordings of real people. See the receipt flow without
        pressing record.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SAMPLES.map((sample) => {
          const Icon = sample.icon;
          return (
            <li key={sample.id}>
              <Link
                to="/meetings/$meetingId"
                params={{ meetingId: sample.id }}
                className="flex h-full flex-col gap-2 rounded-md border border-border bg-bg-elevated p-4 text-left transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid={`sample-card-${sample.id}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-sans text-sm font-medium text-fg">{sample.title}</span>
                <span className="text-xs text-fg-muted">{sample.description}</span>
                <span className="mt-auto text-xs font-medium text-accent">Try this sample →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
