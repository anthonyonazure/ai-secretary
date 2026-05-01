export type Vertical =
  | 'general'
  | 'sales'
  | 'hr'
  | 'education'
  | 'medical'
  | 'support'
  | 'pm'
  | 'psychology';

export type VerticalResolutionInput = {
  userOverride: Vertical | null;
  meetingHint: Vertical | null;
  calendarKeywords: ReadonlyArray<string>;
  participantsCount: number;
  tenantDefault: Vertical;
};

export type VerticalResolution = {
  vertical: Vertical;
  source: 'override' | 'hint' | 'keywords' | 'tenant-default';
  confidence: 'high' | 'medium' | 'low';
};

const KEYWORD_MAP: ReadonlyArray<{ keywords: ReadonlyArray<string>; vertical: Vertical }> = [
  { keywords: ['discovery', 'demo', 'pricing', 'proposal', 'champion'], vertical: 'sales' },
  { keywords: ['interview', 'phone screen', 'panel', 'reference check'], vertical: 'hr' },
  { keywords: ['lecture', 'class', 'syllabus', 'office hours'], vertical: 'education' },
  { keywords: ['intake', 'follow-up', 'visit', 'patient', 'soap'], vertical: 'medical' },
  { keywords: ['ticket', 'incident', 'support'], vertical: 'support' },
  { keywords: ['standup', 'retro', 'roadmap', 'sprint', 'planning'], vertical: 'pm' },
  { keywords: ['session', 'therapy', 'counseling'], vertical: 'psychology' },
];

export const resolveVertical = (input: VerticalResolutionInput): VerticalResolution => {
  if (input.userOverride !== null) {
    return { vertical: input.userOverride, source: 'override', confidence: 'high' };
  }
  if (input.meetingHint !== null) {
    return { vertical: input.meetingHint, source: 'hint', confidence: 'high' };
  }
  const lower = input.calendarKeywords.map((k) => k.toLowerCase());
  const tally = new Map<Vertical, number>();
  for (const { keywords, vertical } of KEYWORD_MAP) {
    for (const word of keywords) {
      if (lower.some((k) => k.includes(word))) {
        tally.set(vertical, (tally.get(vertical) ?? 0) + 1);
      }
    }
  }
  if (tally.size === 0) {
    return { vertical: input.tenantDefault, source: 'tenant-default', confidence: 'low' };
  }
  let best: { vertical: Vertical; count: number } | null = null;
  for (const [vertical, count] of tally) {
    if (best === null || count > best.count) {
      best = { vertical, count };
    }
  }
  if (best === null) {
    return { vertical: input.tenantDefault, source: 'tenant-default', confidence: 'low' };
  }
  return {
    vertical: best.vertical,
    source: 'keywords',
    confidence: best.count >= 2 ? 'high' : 'medium',
  };
};
