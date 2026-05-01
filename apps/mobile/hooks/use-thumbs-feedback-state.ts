export type ThumbsState = 'unset' | 'up' | 'down';

export type ThumbsHistoryItem = {
  meetingId: string;
  state: ThumbsState;
  submittedAtMs: number;
};

export type ThumbsFeedbackInput = {
  meetingId: string;
  pendingState: ThumbsState;
  history: ReadonlyArray<ThumbsHistoryItem>;
  receiptCountForUser: number;
  isPolishWindow: boolean;
  now?: number;
};

export type ThumbsFeedbackResult = {
  showPrompt: boolean;
  showFollowUp: boolean;
  state: ThumbsState;
  submitted: boolean;
  copy: string;
};

const POLISH_RECEIPT_THRESHOLD = 3;

export const deriveThumbsFeedbackState = (input: ThumbsFeedbackInput): ThumbsFeedbackResult => {
  const existing = input.history.find((h) => h.meetingId === input.meetingId);
  const state: ThumbsState = existing?.state ?? input.pendingState;
  const submitted = existing !== undefined;

  if (submitted) {
    return {
      showPrompt: false,
      showFollowUp: state === 'down',
      state,
      submitted: true,
      copy: state === 'down' ? 'Thanks — what could we do better?' : 'Thanks for the feedback.',
    };
  }
  const showPrompt = input.isPolishWindow || input.receiptCountForUser <= POLISH_RECEIPT_THRESHOLD;
  return {
    showPrompt,
    showFollowUp: false,
    state: 'unset',
    submitted: false,
    copy: showPrompt ? 'Was this receipt helpful?' : '',
  };
};
