/**
 * `useUploadProgress` — mobile upload-progress derivation.
 *
 * Pure function that turns the resumable-upload state machine output
 * into display strings for the recording controller's footer:
 *   - Percentage label
 *   - ETA hint ("~12s left")
 *   - Variant (`fresh | retrying | escalated | done | error`)
 *
 * The 10-minute silent retry budget (FR68) is signalled by
 * `retryStartMs` — when set, we render a subtle "Retrying" hint
 * without alarming the user. After the budget elapses (`retryStartMs +
 * 10min < now`), the variant flips to `escalated`.
 */

const TEN_MIN_MS = 10 * 60 * 1000;

export interface UploadProgressInput {
  bytesUploaded: number;
  bytesTotal: number;
  /** When the most-recent retry cycle started — null if not retrying. */
  retryStartMs: number | null;
  /** Current network class hint (best-effort from the platform). */
  networkClass?: 'offline' | 'slow' | 'unknown';
  /** Now reference for testability. */
  now?: number;
  /** Set to true once the upload completes successfully. */
  isDone?: boolean;
  /** Set to true on terminal failure. */
  isError?: boolean;
}

export type UploadProgressVariant = 'fresh' | 'retrying' | 'escalated' | 'done' | 'error';

export interface UploadProgressOutput {
  variant: UploadProgressVariant;
  percent: number;
  /** Human label e.g. "12 MB / 48 MB · 25%". */
  label: string;
  /** Subtle hint shown next to the percentage. Empty string when none. */
  hint: string;
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const deriveUploadProgress = (input: UploadProgressInput): UploadProgressOutput => {
  const total = Math.max(0, input.bytesTotal);
  const uploaded = Math.max(0, Math.min(input.bytesUploaded, total));
  const percent = total === 0 ? 0 : Math.floor((uploaded / total) * 100);
  const label = `${formatBytes(uploaded)} / ${formatBytes(total)} · ${percent}%`;

  if (input.isError) {
    return { variant: 'error', percent, label, hint: 'upload failed' };
  }
  if (input.isDone || (total > 0 && uploaded >= total)) {
    return { variant: 'done', percent: 100, label, hint: '' };
  }

  if (input.retryStartMs !== null && input.retryStartMs !== undefined) {
    const now = input.now ?? Date.now();
    const elapsed = now - input.retryStartMs;
    if (elapsed >= TEN_MIN_MS) {
      return {
        variant: 'escalated',
        percent,
        label,
        hint: 'no progress for 10 minutes — tap to retry',
      };
    }
    const networkHint =
      input.networkClass === 'offline'
        ? 'offline — will resume when connected'
        : input.networkClass === 'slow'
          ? 'slow connection — keeping at it'
          : 'retrying';
    return { variant: 'retrying', percent, label, hint: networkHint };
  }

  return { variant: 'fresh', percent, label, hint: '' };
};
