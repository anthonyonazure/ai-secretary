/**
 * Pure-derivation hook mirror of `apps/mobile/hooks/use-meeting-detail-tabs.ts`.
 *
 * Rendered tab list + default-tab + per-tab badge counts are derived
 * from server state (transcript turns, analysis output, action items,
 * shares) plus the caller's role. Mirrored intentionally — both apps
 * share the same UX contract; the function is small enough that drift
 * isn't a real risk and an extraction would couple the apps' release
 * cadences unnecessarily.
 */

export type MeetingDetailTab =
  | 'receipt'
  | 'transcript'
  | 'analysis'
  | 'actions'
  | 'shares'
  | 'audit';

export interface MeetingDetailInput {
  hasTranscript: boolean;
  hasAnalysis: boolean;
  actionItemCount: number;
  shareCount: number;
  isAdmin: boolean;
  preferredTab?: MeetingDetailTab;
}

export interface MeetingDetailTabsResult {
  visibleTabs: ReadonlyArray<MeetingDetailTab>;
  defaultTab: MeetingDetailTab;
  badges: Record<MeetingDetailTab, number | null>;
}

export const deriveMeetingDetailTabs = (input: MeetingDetailInput): MeetingDetailTabsResult => {
  const visible: MeetingDetailTab[] = ['receipt'];
  if (input.hasTranscript) visible.push('transcript');
  if (input.hasAnalysis) visible.push('analysis');
  if (input.actionItemCount > 0 || input.hasAnalysis) visible.push('actions');
  if (input.shareCount > 0) visible.push('shares');
  if (input.isAdmin) visible.push('audit');

  const defaultTab: MeetingDetailTab =
    input.preferredTab && visible.includes(input.preferredTab) ? input.preferredTab : 'receipt';

  const badges: Record<MeetingDetailTab, number | null> = {
    receipt: null,
    transcript: null,
    analysis: null,
    actions: input.actionItemCount > 0 ? input.actionItemCount : null,
    shares: input.shareCount > 0 ? input.shareCount : null,
    audit: null,
  };

  return { visibleTabs: visible, defaultTab, badges };
};
