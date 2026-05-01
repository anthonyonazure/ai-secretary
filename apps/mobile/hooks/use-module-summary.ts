/**
 * `useModuleSummary` — pure helpers for rendering module-output
 * summary cards on the mobile receipt screen.
 *
 * Extracted from web's `AnalysisCard` rendering logic but trimmed to
 * the fields the mobile screen actually shows: title, summary, top
 * 3 bullets per slot, citation count.
 *
 * The full analysis surface stays on web (more density) but the
 * mobile receipt needs a compact preview for at-a-glance review.
 */

import type { ModuleId } from '@aisecretary/shared';

export interface AnalysisBulletPreview {
  claim: string;
  citationCount: number;
}

export interface ModuleSummaryPreview {
  moduleId: ModuleId;
  title: string;
  /** Single-paragraph summary — the screen renders this with leading-loose. */
  summary: string;
  /** Top-3 bullets per content slot. */
  topBullets: AnalysisBulletPreview[];
  /** Confidence — 'high' / 'low' / null. */
  confidence: 'high' | 'low' | null;
}

interface BulletInput {
  claim: string;
  citations?: ReadonlyArray<unknown>;
}

interface ModuleOutputInput {
  moduleId: ModuleId;
  title: string;
  summary: string;
  /** Discriminated content slots; we collapse them into a flat top-N list. */
  bullets?: ReadonlyArray<BulletInput>;
  confidence?: 'high' | 'low' | null;
}

/**
 * Build a compact preview from a full module-output payload. The
 * caller already deserialised the wire payload via the shared zod
 * schema; we narrow to the fields the mobile screen uses.
 */
export const buildModuleSummaryPreview = (
  raw: ModuleOutputInput,
  options: { topN?: number } = {},
): ModuleSummaryPreview => {
  const topN = options.topN ?? 3;
  const bullets = raw.bullets ?? [];
  return {
    moduleId: raw.moduleId,
    title: raw.title,
    summary: raw.summary,
    topBullets: bullets.slice(0, topN).map((b) => ({
      claim: b.claim,
      citationCount: b.citations?.length ?? 0,
    })),
    confidence: raw.confidence ?? null,
  };
};

/** A11y label for the module-summary card header. */
export const buildAriaLabel = (preview: ModuleSummaryPreview): string => {
  const conf =
    preview.confidence === 'high'
      ? 'high confidence'
      : preview.confidence === 'low'
        ? 'low confidence'
        : 'confidence not yet scored';
  return `${preview.title} — ${conf}`;
};
