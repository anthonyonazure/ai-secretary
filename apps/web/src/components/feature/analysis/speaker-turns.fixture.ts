import type { CitationRef } from '@aisecretary/shared';

/**
 * Speaker-turn fixture used by `useSpeakerTurns` while the transcription
 * pipeline is in flight (Story 2.2). Mirrors the `speaker_turns` row
 * shape from `packages/db/src/schema/speaker-turns.ts`.
 *
 * Citations on `analysis-card.stories.tsx` reference `t-XX` style turnIds
 * — the fixtures here use the same convention so stories that target the
 * fixture meeting render with seekable preview text.
 */
export interface SpeakerTurnFixture {
  meetingId: string;
  turnId: string;
  speaker: string | null;
  spanStartMs: number;
  spanEndMs: number;
  text: string;
  sequence: number;
}

export const FIXTURE_MEETING_ID = '00000000-0000-0000-0000-00000000aaaa';

export const FIXTURE_MEETING_TITLE = 'Q3 onboarding sync · Apr 28';

export const fixtureSpeakerTurns: SpeakerTurnFixture[] = [
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-04',
    speaker: 'Dana',
    spanStartMs: 41_000,
    spanEndMs: 49_000,
    text: 'Phase 0 component sequence is locked: pill, then card, then chip. We agreed on that yesterday.',
    sequence: 4,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-08',
    speaker: 'Priya',
    spanStartMs: 92_000,
    spanEndMs: 102_500,
    text: "Yes — I have budget authority through Q4. We don't need to loop in finance unless it goes above the agreed cap.",
    sequence: 8,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-09',
    speaker: 'Sam',
    spanStartMs: 142_000,
    spanEndMs: 151_000,
    text: 'I noticed anxiety surface around the upcoming family visit — that pattern came up last session too.',
    sequence: 9,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-12',
    speaker: 'Dana',
    spanStartMs: 184_000,
    spanEndMs: 198_000,
    text: 'So three decisions on the table — the onboarding cadence, the Slack export fix, and the EU residency follow-up. Two of those need follow-up by Friday.',
    sequence: 12,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-15',
    speaker: 'Dana',
    spanStartMs: 224_000,
    spanEndMs: 233_000,
    text: "I'll wire the Storybook contrast addon by Tuesday and post a screenshot in the channel.",
    sequence: 15,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-21',
    speaker: 'Jordan',
    spanStartMs: 411_000,
    spanEndMs: 426_500,
    text: 'Procurement is going to want a SOC2 Type II report before they sign. We can move it forward if we can get that pack ready by next Tuesday.',
    sequence: 21,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-37',
    speaker: 'Sam',
    spanStartMs: 612_000,
    spanEndMs: 624_000,
    text: 'Customers keep asking about EU data residency — it has come up in three of the last five demos.',
    sequence: 37,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-39',
    speaker: null,
    spanStartMs: 645_000,
    spanEndMs: 654_000,
    text: 'And the eu-west-1 storage option is the one they ask about specifically, not just generic GDPR.',
    sequence: 39,
  },
  {
    meetingId: FIXTURE_MEETING_ID,
    turnId: 't-44',
    speaker: 'Dr. Reyes',
    spanStartMs: 1_120_000,
    spanEndMs: 1_134_000,
    text: 'PHQ-9 score came in at 12 — that warrants a follow-up suicidality assessment per the protocol.',
    sequence: 44,
  },
];

/**
 * Resolve a single fixture turn for a citation. Returns `undefined`
 * when the citation references a meeting/turn that the fixture does not
 * cover — the chip then renders in the `disabled` state.
 */
export function findFixtureTurn(citation: CitationRef): SpeakerTurnFixture | undefined {
  return fixtureSpeakerTurns.find(
    (t) => t.meetingId === citation.meetingId && t.turnId === citation.turnId,
  );
}
