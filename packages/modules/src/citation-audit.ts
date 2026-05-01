/**
 * Story 3.6 — citation audit.
 *
 * Walks a `ModuleOutput` and returns every analytic claim that lacks a
 * citation. The CI gate (`scripts/check-citations.ts`) runs this against
 * fixture outputs + nightly eval samples and fails the build on any
 * missing-citation entry.
 *
 * The worker pipeline (Story 3.2 summarize + Story 3.3 extract-action-
 * items) can also call this at runtime to drop bad bullets BEFORE writing
 * to `module_outputs` — keeping the AnalysisCard's "every claim has a
 * CitationChip" invariant tight even if the LLM gateway's schema-parse
 * retry doesn't catch the regression.
 *
 * Pure function — no I/O, no schema parsing. Caller pre-validates.
 */

import type { AnalysisBullet, ModuleOutput } from '@aisecretary/shared';

export interface ClaimAuditEntry {
  /** JSON-pointer-ish path: `bullets[0]`, `objections[2]`, `riskFlags[0]`. */
  path: string;
  /** The claim text — surfaced in the CI failure log + the future
   *  AnalysisCard low-confidence flag. */
  claim: string;
  /** Number of citations the LLM emitted. Zero = the failure case. */
  citationCount: number;
}

export interface CitationAuditResult {
  /** Bullets / claims without at least one citation. */
  missing: ClaimAuditEntry[];
  /** Total analytic claims walked across every slot. */
  total: number;
}

/**
 * Slots — by module — that contain `AnalysisBullet[]` and therefore need
 * citations. The map mirrors the discriminated union in
 * `@aisecretary/shared/schemas/module-output`. Adding a vertical = adding
 * one entry here AND extending the schema.
 *
 * The `bullets` slot is shared by every variant (it's the common
 * baseline). Module-specific slots layer on top.
 */
const REQUIRED_CITATION_SLOTS: Record<ModuleOutput['module'], readonly string[]> = {
  general: ['bullets'],
  sales: ['bullets', 'objections', 'nextSteps'],
  hr: ['bullets', 'competencies'],
  education: ['bullets', 'engagement', 'objectiveCoverage'],
  medical: ['bullets', 'riskFlags'],
  support: ['bullets', 'escalationFlags'],
  pm: ['bullets', 'decisions', 'actionItems', 'risks'],
  psychology: ['bullets', 'sessionThemes'],
};

const isAnalysisBulletArray = (value: unknown): value is AnalysisBullet[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      'claim' in entry &&
      'citations' in entry &&
      Array.isArray((entry as { citations: unknown }).citations),
  );

/**
 * Audit a single module output. Returns the list of claims missing
 * citations + a running total of analytic claims walked.
 *
 * The `total` count is useful for ratio-based metrics (e.g. "what % of
 * claims this week were uncited") — Story 3.6 nightly eval can graph it.
 */
export function auditCitations(output: ModuleOutput): CitationAuditResult {
  const slots = REQUIRED_CITATION_SLOTS[output.module];
  const missing: ClaimAuditEntry[] = [];
  let total = 0;

  for (const slot of slots) {
    const value = (output as unknown as Record<string, unknown>)[slot];
    if (!isAnalysisBulletArray(value)) continue;
    value.forEach((bullet, index) => {
      total += 1;
      if (bullet.citations.length === 0) {
        missing.push({
          path: `${slot}[${index}]`,
          claim: bullet.claim,
          citationCount: 0,
        });
      }
    });
  }

  return { missing, total };
}

/** Convenience: bulk-audit a list of outputs and aggregate the misses. */
export function auditAllCitations(outputs: ReadonlyArray<ModuleOutput>): {
  missing: Array<ClaimAuditEntry & { fixture: number }>;
  total: number;
} {
  const missing: Array<ClaimAuditEntry & { fixture: number }> = [];
  let total = 0;
  outputs.forEach((output, fixtureIndex) => {
    const result = auditCitations(output);
    total += result.total;
    for (const entry of result.missing) {
      missing.push({ ...entry, fixture: fixtureIndex });
    }
  });
  return { missing, total };
}
