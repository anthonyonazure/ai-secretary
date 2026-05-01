export type MeetingDetailTab =
  | 'receipt'
  | 'transcript'
  | 'analysis'
  | 'actions'
  | 'shares'
  | 'audit';

export type MeetingDetailInput = {
  hasTranscript: boolean;
  hasAnalysis: boolean;
  actionItemCount: number;
  shareCount: number;
  isAdmin: boolean;
  preferredTab?: MeetingDetailTab;
};

export type MeetingDetailTabsResult = {
  visibleTabs: ReadonlyArray<MeetingDetailTab>;
  defaultTab: MeetingDetailTab;
  badges: Record<MeetingDetailTab, number | null>;
};

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
