export type ActionItemEditInput = {
  draftTitle: string;
  draftOwnerUserId: string | null;
  draftDueDate: string | null;
  originalTitle: string;
  originalOwnerUserId: string | null;
  originalDueDate: string | null;
  isSubmitting: boolean;
  serverError: string | null;
};

export type ActionItemEditState = {
  hasUnsavedChanges: boolean;
  canSave: boolean;
  blocker: 'empty-title' | 'submitting' | null;
  errorBanner: string | null;
};

const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 280;

export const deriveActionItemEditState = (input: ActionItemEditInput): ActionItemEditState => {
  const trimmedTitle = input.draftTitle.trim();
  const titleChanged = trimmedTitle !== input.originalTitle.trim();
  const ownerChanged = input.draftOwnerUserId !== input.originalOwnerUserId;
  const dueDateChanged = input.draftDueDate !== input.originalDueDate;
  const hasUnsavedChanges = titleChanged || ownerChanged || dueDateChanged;

  if (trimmedTitle.length < MIN_TITLE_LENGTH || trimmedTitle.length > MAX_TITLE_LENGTH) {
    return {
      hasUnsavedChanges,
      canSave: false,
      blocker: 'empty-title',
      errorBanner: input.serverError,
    };
  }
  if (input.isSubmitting) {
    return {
      hasUnsavedChanges,
      canSave: false,
      blocker: 'submitting',
      errorBanner: input.serverError,
    };
  }
  return {
    hasUnsavedChanges,
    canSave: hasUnsavedChanges,
    blocker: null,
    errorBanner: input.serverError,
  };
};
