/**
 * Pure helpers for grouping + summarizing audit log entries.
 *
 * Used by:
 *   - admin Audit Log viewer (Story 12.5) — collapses bursts ("47 share
 *     creates by Casey in 5 minutes") into a single row.
 *   - DSAR export (Story 14.1) — groups by resource for the PDF
 *     summary page.
 *   - admin tenant-overview dashboard activity heatmap.
 *
 * No I/O. No React. Web + mobile + workers all consume.
 */

export interface AuditEntryShape {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface AuditGroup {
  /** Composite key: `${actorUserId ?? 'system'}|${actionPrefix}|${windowStartMs}`. */
  key: string;
  actorUserId: string | null;
  actionPrefix: string;
  resourceType: string;
  count: number;
  windowStartMs: number;
  windowEndMs: number;
  sampleIds: ReadonlyArray<string>;
}

export type GroupingInput = {
  entries: ReadonlyArray<AuditEntryShape>;
  /** Time window in ms; defaults to 5 minutes. Adjacent entries that fall
   *  inside the same window collapse into one group. */
  windowMs?: number;
  /** Max sample ids to keep on each group for drill-in. */
  maxSamples?: number;
};

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SAMPLES = 5;

/** Action prefix for collapsing — "share.created" + "share.created" group; "share.created" + "share.expired" do not. */
const actionPrefix = (action: string): string => action;

export const groupAuditEntries = (input: GroupingInput): ReadonlyArray<AuditGroup> => {
  const windowMs = input.windowMs ?? DEFAULT_WINDOW_MS;
  const maxSamples = input.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const sorted = [...input.entries].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const groups = new Map<string, AuditGroup>();
  for (const entry of sorted) {
    const ts = Date.parse(entry.createdAt);
    if (!Number.isFinite(ts)) continue;
    const bucket = Math.floor(ts / windowMs) * windowMs;
    const key = `${entry.actorUserId ?? 'system'}|${actionPrefix(entry.action)}|${bucket}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.windowEndMs = Math.max(existing.windowEndMs, ts);
      if (existing.sampleIds.length < maxSamples) {
        (existing.sampleIds as string[]).push(entry.id);
      }
    } else {
      groups.set(key, {
        key,
        actorUserId: entry.actorUserId,
        actionPrefix: actionPrefix(entry.action),
        resourceType: entry.resourceType,
        count: 1,
        windowStartMs: ts,
        windowEndMs: ts,
        sampleIds: [entry.id],
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.windowEndMs - a.windowEndMs);
};

/** Tally audit entries by resource type — used for the DSAR cascade preview. */
export const tallyByResourceType = (
  entries: ReadonlyArray<AuditEntryShape>,
): ReadonlyArray<{ resourceType: string; count: number }> => {
  const tally = new Map<string, number>();
  for (const e of entries) {
    tally.set(e.resourceType, (tally.get(e.resourceType) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([resourceType, count]) => ({ resourceType, count }))
    .sort((a, b) => b.count - a.count);
};
