/**
 * `useSampleMeetings` — mobile counterpart to web's
 * `EmptyStateRecipient` sample-library row (Story 1.7).
 *
 * Static, per-vertical sample meeting fixtures so first-launch users
 * can poke at the receipt UI without having recorded anything yet.
 * The fixtures live in shared so iOS / Android / Web all surface the
 * same set; this hook narrows by the user's selected vertical.
 */

export type SampleMeetingVertical =
  | 'general'
  | 'sales'
  | 'hr'
  | 'education'
  | 'medical'
  | 'support'
  | 'pm'
  | 'psychology';

export interface SampleMeeting {
  id: string;
  vertical: SampleMeetingVertical;
  title: string;
  /** Human duration label — "32 min". */
  duration: string;
  /** One-line teaser. */
  summary: string;
}

/** Static fixture set — kept in code (not in the DB) so it ships with the bundle. */
export const SAMPLE_MEETINGS: ReadonlyArray<SampleMeeting> = [
  {
    id: 'sample-sales-call',
    vertical: 'sales',
    title: 'Quarterly review with Acme Corp',
    duration: '32 min',
    summary: '3 objections raised, 2 next-steps captured.',
  },
  {
    id: 'sample-one-on-one',
    vertical: 'hr',
    title: 'One-on-one with Casey',
    duration: '24 min',
    summary: 'Career-growth follow-up + a kudos for last week.',
  },
  {
    id: 'sample-standup',
    vertical: 'pm',
    title: 'Engineering standup',
    duration: '12 min',
    summary: 'Three blockers + one risk flagged.',
  },
  {
    id: 'sample-discovery',
    vertical: 'sales',
    title: 'Discovery call with Foo Industries',
    duration: '45 min',
    summary: 'Pain points: pricing, integrations, timeline.',
  },
  {
    id: 'sample-soap-note',
    vertical: 'medical',
    title: 'Patient consultation — example',
    duration: '15 min',
    summary: 'Subjective + objective + assessment + plan extracted.',
  },
];

/** Filter the sample library by vertical. Pass `null` to see them all. */
export const filterSamplesByVertical = (
  vertical: SampleMeetingVertical | null,
): SampleMeeting[] => {
  if (vertical === null) return [...SAMPLE_MEETINGS];
  return SAMPLE_MEETINGS.filter((s) => s.vertical === vertical);
};
