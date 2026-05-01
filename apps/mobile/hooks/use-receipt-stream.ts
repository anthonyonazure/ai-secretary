/**
 * `useReceiptStream` — pure helper for the mobile receipt-stream
 * layout (Story 2.5).
 *
 * After the user taps "Stop", the receipt frame appears immediately
 * with skeletons describing the upcoming stages. As stages complete,
 * the corresponding skeleton flips to the rendered content. This
 * helper derives the per-stage status from the per-stage timestamps
 * the recording row carries.
 *
 * Stages (in order):
 *   1. transcript        — speaker-turns landed
 *   2. summary           — module summary string landed
 *   3. action-items      — action_items rows landed
 *   4. analysis          — module_outputs row landed
 *
 * Per-vertical SLA copy (FR79) — clinical verticals (medical /
 * psychology) get "<30 min" expected-arrival; non-clinical get
 * "<3 min". The copy stays HONEST when the SLA elapses ("still
 * processing — taking longer than usual") rather than hiding
 * the slowness.
 */

export type ReceiptStage = 'transcript' | 'summary' | 'action-items' | 'analysis';

export type StageStatus = 'pending' | 'in-flight' | 'complete' | 'overdue';

export interface ReceiptStreamInput {
  /** When the recording stopped — drives expected-arrival math. */
  stoppedAtMs: number;
  /** Per-stage completion timestamps (ms since epoch). null = pending. */
  transcriptAtMs: number | null;
  summaryAtMs: number | null;
  actionItemsAtMs: number | null;
  analysisAtMs: number | null;
  /** Drives SLA copy. */
  vertical: 'general' | 'sales' | 'hr' | 'education' | 'medical' | 'support' | 'pm' | 'psychology';
  /** Now reference. */
  now?: number;
}

export interface ReceiptStreamOutput {
  stages: Array<{ stage: ReceiptStage; status: StageStatus }>;
  /** True when every stage is complete. */
  allComplete: boolean;
  /** Plain-language ETA copy ("Ready in ~2 min" / "Still working — taking longer than usual"). */
  etaCopy: string;
}

const SLA_MS_PER_VERTICAL: Record<ReceiptStreamInput['vertical'], number> = {
  general: 3 * 60 * 1000,
  sales: 3 * 60 * 1000,
  hr: 3 * 60 * 1000,
  education: 3 * 60 * 1000,
  support: 3 * 60 * 1000,
  pm: 3 * 60 * 1000,
  // Clinical verticals get a 30-minute window per FR79.
  medical: 30 * 60 * 1000,
  psychology: 30 * 60 * 1000,
};

const stageStatus = (
  completedAtMs: number | null,
  stoppedAtMs: number,
  slaMs: number,
  now: number,
): StageStatus => {
  if (completedAtMs !== null) return 'complete';
  if (now - stoppedAtMs < 5_000) return 'pending';
  if (now - stoppedAtMs > slaMs) return 'overdue';
  return 'in-flight';
};

const formatRemaining = (deadline: number, now: number): string => {
  const remainingMs = deadline - now;
  if (remainingMs <= 0) return 'Still working — taking longer than usual';
  const minutes = Math.ceil(remainingMs / 60_000);
  if (minutes <= 1) return 'Ready any moment';
  return `Ready in ~${minutes} min`;
};

export const deriveReceiptStream = (input: ReceiptStreamInput): ReceiptStreamOutput => {
  const now = input.now ?? Date.now();
  const sla = SLA_MS_PER_VERTICAL[input.vertical];
  const stages: ReceiptStreamOutput['stages'] = [
    { stage: 'transcript', status: stageStatus(input.transcriptAtMs, input.stoppedAtMs, sla, now) },
    { stage: 'summary', status: stageStatus(input.summaryAtMs, input.stoppedAtMs, sla, now) },
    {
      stage: 'action-items',
      status: stageStatus(input.actionItemsAtMs, input.stoppedAtMs, sla, now),
    },
    { stage: 'analysis', status: stageStatus(input.analysisAtMs, input.stoppedAtMs, sla, now) },
  ];
  const allComplete = stages.every((s) => s.status === 'complete');
  const deadline = input.stoppedAtMs + sla;
  return {
    stages,
    allComplete,
    etaCopy: allComplete ? '' : formatRemaining(deadline, now),
  };
};
