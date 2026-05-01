export type CoachingTimestamp = {
  spanStartMs: number;
  spanEndMs: number;
};

export type CoachingDraft = {
  id: string;
  authorUserId: string;
  targetUserId: string;
  meetingId: string;
  text: string;
  span: CoachingTimestamp | null;
  privateToManager: boolean;
};

export type CoachingFeedbackInput = {
  draft: CoachingDraft;
  isManager: boolean;
  isOwner: boolean;
  recordingDurationMs: number;
};

export type CoachingFeedbackState = {
  canPost: boolean;
  spanLabel: string | null;
  blockers: ReadonlyArray<
    'not-manager' | 'self-coaching' | 'empty-text' | 'span-out-of-bounds' | 'span-inverted'
  >;
};

export const MIN_FEEDBACK_LENGTH = 5;
export const MAX_FEEDBACK_LENGTH = 2000;

const formatStamp = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const deriveCoachingFeedbackState = (
  input: CoachingFeedbackInput,
): CoachingFeedbackState => {
  const blockers: CoachingFeedbackState['blockers'][number][] = [];
  if (!input.isManager) blockers.push('not-manager');
  if (input.draft.authorUserId === input.draft.targetUserId) {
    blockers.push('self-coaching');
  }
  const trimmed = input.draft.text.trim();
  if (trimmed.length < MIN_FEEDBACK_LENGTH || trimmed.length > MAX_FEEDBACK_LENGTH) {
    blockers.push('empty-text');
  }
  if (input.draft.span !== null) {
    if (input.draft.span.spanStartMs >= input.draft.span.spanEndMs) {
      blockers.push('span-inverted');
    }
    if (
      input.draft.span.spanStartMs < 0 ||
      input.draft.span.spanEndMs > input.recordingDurationMs
    ) {
      blockers.push('span-out-of-bounds');
    }
  }
  const canPost = blockers.length === 0;
  const spanLabel =
    input.draft.span !== null
      ? `${formatStamp(input.draft.span.spanStartMs)}–${formatStamp(input.draft.span.spanEndMs)}`
      : null;
  return { canPost, spanLabel, blockers };
};
