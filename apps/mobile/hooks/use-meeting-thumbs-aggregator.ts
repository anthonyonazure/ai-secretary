/**
 * `aggregateMeetingThumbs` — derives the per-tenant thumbs-feedback
 * tally surfaced on the team-lead dashboard + the Growth PM weekly
 * report.
 *
 * Pure helper. Inputs are normalized rows; the host owns the SQL +
 * date-window query.
 */

export type ThumbsKind = 'up' | 'down';

export type MeetingThumbsRow = {
  meetingId: string;
  userId: string;
  kind: ThumbsKind;
  submittedAtMs: number;
  receiptOrdinal: number;
};

export type ThumbsAggregateInput = {
  rows: ReadonlyArray<MeetingThumbsRow>;
  windowStartMs: number;
  windowEndMs: number;
  /** First-N receipts get extra polish — telemetry isolates them. */
  polishWindowReceiptN?: number;
};

export type ThumbsAggregateResult = {
  total: number;
  up: number;
  down: number;
  positiveRate: number;
  polishWindow: {
    total: number;
    positiveRate: number;
  };
  /** True when positiveRate falls below the alarm threshold; gives the
   *  Growth PM a one-line "trigger receipt design review" signal. */
  belowAlarmThreshold: boolean;
};

const DEFAULT_POLISH_RECEIPT_N = 3;
const ALARM_THRESHOLD = 0.5;
const ALARM_MIN_VOLUME = 100;

export const aggregateMeetingThumbs = (input: ThumbsAggregateInput): ThumbsAggregateResult => {
  const polishN = input.polishWindowReceiptN ?? DEFAULT_POLISH_RECEIPT_N;
  let total = 0;
  let up = 0;
  let polishTotal = 0;
  let polishUp = 0;
  for (const row of input.rows) {
    if (row.submittedAtMs < input.windowStartMs || row.submittedAtMs > input.windowEndMs) {
      continue;
    }
    total += 1;
    if (row.kind === 'up') up += 1;
    if (row.receiptOrdinal <= polishN) {
      polishTotal += 1;
      if (row.kind === 'up') polishUp += 1;
    }
  }
  const down = total - up;
  const positiveRate = total > 0 ? up / total : 0;
  const polishPositiveRate = polishTotal > 0 ? polishUp / polishTotal : 0;
  return {
    total,
    up,
    down,
    positiveRate,
    polishWindow: {
      total: polishTotal,
      positiveRate: polishPositiveRate,
    },
    belowAlarmThreshold: total >= ALARM_MIN_VOLUME && positiveRate < ALARM_THRESHOLD,
  };
};
