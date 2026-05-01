/**
 * `deriveCellularBudget` — derives cellular usage warnings + the
 * "switch to Wi-Fi for uploads" decision used by the recording
 * background-upload pipeline.
 *
 * The native shell wires this to `expo-network` + a per-tenant
 * cellular cap setting; the helper picks which warning to surface and
 * whether to defer the upload.
 */

export type CellularBudgetInput = {
  isOnCellular: boolean;
  cellularBytesUsedThisMonth: number;
  cellularMonthlyCapBytes: number | null;
  pendingUploadBytes: number;
  cellularUploadsAllowed: boolean;
};

export type CellularBudgetState = {
  shouldDeferUpload: boolean;
  warningKind: 'none' | 'over-cap' | 'near-cap' | 'large-pending' | 'cellular-disallowed';
  copy: string | null;
  percentUsed: number;
};

const NEAR_CAP_THRESHOLD = 0.8;
const LARGE_UPLOAD_THRESHOLD_BYTES = 100 * 1024 * 1024;

export const deriveCellularBudget = (input: CellularBudgetInput): CellularBudgetState => {
  if (!input.isOnCellular) {
    return {
      shouldDeferUpload: false,
      warningKind: 'none',
      copy: null,
      percentUsed: 0,
    };
  }

  if (!input.cellularUploadsAllowed) {
    return {
      shouldDeferUpload: true,
      warningKind: 'cellular-disallowed',
      copy: 'Cellular uploads are off — your upload will resume on Wi-Fi.',
      percentUsed: 0,
    };
  }

  const cap = input.cellularMonthlyCapBytes;
  const percentUsed =
    cap !== null && cap > 0 ? Math.min(1, input.cellularBytesUsedThisMonth / cap) : 0;

  if (cap !== null && input.cellularBytesUsedThisMonth >= cap) {
    return {
      shouldDeferUpload: true,
      warningKind: 'over-cap',
      copy: 'Cellular cap reached. Connect to Wi-Fi to upload.',
      percentUsed: 1,
    };
  }

  if (cap !== null && percentUsed >= NEAR_CAP_THRESHOLD) {
    return {
      shouldDeferUpload: false,
      warningKind: 'near-cap',
      copy: `Approaching cellular cap (${Math.round(percentUsed * 100)}%).`,
      percentUsed,
    };
  }

  if (input.pendingUploadBytes >= LARGE_UPLOAD_THRESHOLD_BYTES) {
    return {
      shouldDeferUpload: false,
      warningKind: 'large-pending',
      copy: 'Large upload pending — Wi-Fi recommended.',
      percentUsed,
    };
  }

  return {
    shouldDeferUpload: false,
    warningKind: 'none',
    copy: null,
    percentUsed,
  };
};
