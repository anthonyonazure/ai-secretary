/**
 * `deriveErasureCascadePreview` — Story 14.2 erasure-cascade preview
 * derivation. The host queries the server for the cascade scope and
 * passes the per-table tally; this helper composes the human-readable
 * confirmation copy and decides whether to show the "Are you sure?"
 * gate.
 */

export type ErasureCascadeTally = {
  resourceType: string;
  count: number;
  /** Strategy applied: cascade-source / cascade / shred / redact. */
  strategy: 'cascade-source' | 'cascade' | 'shred' | 'redact';
};

export type ErasureCascadePreviewInput = {
  subjectEmail: string;
  tally: ReadonlyArray<ErasureCascadeTally>;
  /** Whether the requestor has typed-confirmed the irreversibility. */
  hasTypedConfirm: boolean;
  /** What the requestor has typed in the confirm field. */
  typedConfirm: string;
  isCommitting: boolean;
  errorMessage: string | null;
};

export type ErasureCascadePreviewState = {
  totalCount: number;
  primaryCopy: string;
  detailLines: ReadonlyArray<string>;
  canCommit: boolean;
  showSpinner: boolean;
  errorBanner: string | null;
};

const STRATEGY_LABEL: Record<ErasureCascadeTally['strategy'], string> = {
  'cascade-source': 'Delete',
  cascade: 'Delete cascaded',
  shred: 'Shred (overwrite)',
  redact: 'Redact PII',
};

export const deriveErasureCascadePreview = (
  input: ErasureCascadePreviewInput,
): ErasureCascadePreviewState => {
  const totalCount = input.tally.reduce((sum, t) => sum + t.count, 0);
  const detailLines = input.tally.map(
    (t) => `${STRATEGY_LABEL[t.strategy]}: ${t.count} ${t.resourceType}`,
  );
  const expectedConfirm = `delete ${input.subjectEmail.toLowerCase()}`;
  const matchedConfirm = input.typedConfirm.trim().toLowerCase() === expectedConfirm;
  const canCommit =
    !input.isCommitting && totalCount > 0 && input.hasTypedConfirm && matchedConfirm;

  const primaryCopy =
    totalCount === 0
      ? `No data found for ${input.subjectEmail}.`
      : `Erasing ${totalCount} record${totalCount === 1 ? '' : 's'} for ${input.subjectEmail}.`;

  return {
    totalCount,
    primaryCopy,
    detailLines,
    canCommit,
    showSpinner: input.isCommitting,
    errorBanner: input.errorMessage,
  };
};
