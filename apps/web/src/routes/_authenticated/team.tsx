/**
 * `/team` — team-lead parallel product space (Story 8.6).
 *
 * Per UX-spec discipline (Step 5 anti-pattern #6): the team-lead view
 * is its own IA, not a tab inside a teammate's meeting. This route
 * lists the team-meetings roll-up alongside any coaching notes the
 * lead has authored. The roll-up + team-feed surfaces are stub-shaped
 * here — the full read-model lands when the team-meetings query API
 * ships in a follow-up slice. Today the surface previews the visual
 * contract for `ManagerCoachingCard` so the design intent is proved
 * end-to-end.
 *
 * Surveillance aesthetic explicitly avoided:
 *   - No score / leaderboard header.
 *   - Coach annotations live alongside the meeting receipt, not above
 *     teammate identities.
 *   - Visual hue + density mirror the rest of the app — no "manager
 *     dashboard" chrome.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useState } from 'react';

import {
  type CoachingAnnotation,
  ManagerCoachingCard,
} from '../../components/feature/team-lead/manager-coaching-card';

export const Route = createFileRoute('/_authenticated/team')({
  component: TeamSpaceRoute,
});

const SAMPLE_ANNOTATIONS: CoachingAnnotation[] = [
  {
    id: 'a-1',
    note: 'Nice job restating their concern back to them — keep doing that.',
    citation: {
      meetingId: '11111111-1111-1111-1111-111111111111',
      turnId: 'turn-12',
      spanStartMs: 65_000,
      spanEndMs: 72_000,
      speaker: 'Anthony',
    },
    coachName: 'Casey Lee',
    createdAt: '2026-04-29T15:00:00.000Z',
    sharedBack: false,
  },
  {
    id: 'a-2',
    note: 'Their pricing question came in twice — try a stronger anchor up front next time.',
    citation: {
      meetingId: '11111111-1111-1111-1111-111111111111',
      turnId: 'turn-23',
      spanStartMs: 540_000,
      spanEndMs: 552_000,
      speaker: 'Anthony',
    },
    coachName: 'Casey Lee',
    createdAt: '2026-04-29T15:05:00.000Z',
    sharedBack: true,
  },
];

function TeamSpaceRoute() {
  const [annotations, setAnnotations] = useState<CoachingAnnotation[]>(SAMPLE_ANNOTATIONS);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleShareBack = (id: string) => {
    // Optimistic local-state flip until the share-back API ships.
    setPendingId(id);
    setTimeout(() => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, sharedBack: true } : a)));
      setPendingId(null);
    }, 200);
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Team space</h1>
      </header>

      <p className="text-sm text-fg-muted">
        Coaching notes you've left on teammates' meetings. Notes live alongside the meeting itself —
        share back when you want them to see your annotation.
      </p>

      <ul className="flex flex-col gap-3">
        {annotations.map((a) => (
          <li key={a.id}>
            <ManagerCoachingCard
              annotation={a}
              isPending={pendingId === a.id}
              onShareBack={handleShareBack}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
