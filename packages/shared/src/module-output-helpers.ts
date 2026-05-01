/**
 * Pure helpers that walk a `ModuleOutput` (discriminated union) and
 * extract analytic claims, citations, and counts. Used by:
 *
 *  - the citation-required CI gate (Story 3.6)
 *  - the AnalysisCard's "X claims · Y citations" header strip
 *  - the share-token landing page that exposes a single insight
 *  - the activity-tally summary in the audit-log viewer
 */

import type { AnalysisBullet, CitationRef, ModuleOutput } from './schemas/module-output.js';

/**
 * Returns every analytic claim across whatever module-specific slots
 * carry citations, plus a path-pointer for CI / debug surfaces.
 */
export interface FlatClaim {
  /** "bullets[0]", "objections[2]", "soap.subjective", etc. */
  path: string;
  /** Claim text. */
  claim: string;
  /** Citations attached. */
  citations: ReadonlyArray<CitationRef>;
}

const flattenBullets = (bullets: ReadonlyArray<AnalysisBullet>, prefix: string): FlatClaim[] =>
  bullets.map((b, i) => ({
    path: `${prefix}[${i}]`,
    claim: b.claim,
    citations: b.citations,
  }));

/**
 * Walk a `ModuleOutput` and return every claim flattened into a single
 * array. Module-specific slots (sales objections, medical risk-flags,
 * pm decisions, etc.) are recognized by name.
 */
export const flattenClaims = (output: ModuleOutput): ReadonlyArray<FlatClaim> => {
  const out: FlatClaim[] = [...flattenBullets(output.bullets ?? [], 'bullets')];
  switch (output.module) {
    case 'sales':
      out.push(...flattenBullets(output.objections, 'objections'));
      out.push(...flattenBullets(output.nextSteps, 'nextSteps'));
      break;
    case 'medical':
      out.push(...flattenBullets(output.riskFlags, 'riskFlags'));
      break;
    case 'pm':
      out.push(...flattenBullets(output.decisions, 'decisions'));
      out.push(...flattenBullets(output.actionItems, 'actionItems'));
      out.push(...flattenBullets(output.risks, 'risks'));
      break;
    case 'hr':
      out.push(...flattenBullets(output.competencies, 'competencies'));
      break;
    case 'education':
      out.push(...flattenBullets(output.engagement, 'engagement'));
      out.push(...flattenBullets(output.objectiveCoverage, 'objectiveCoverage'));
      break;
    case 'support':
      out.push(...flattenBullets(output.escalationFlags, 'escalationFlags'));
      break;
    case 'psychology':
      out.push(...flattenBullets(output.sessionThemes, 'sessionThemes'));
      break;
    default:
      break;
  }
  return out;
};

/** Counts of (claims, citations, ungrounded). */
export interface ModuleOutputCounts {
  claims: number;
  citations: number;
  ungrounded: number;
}

export const countClaims = (output: ModuleOutput): ModuleOutputCounts => {
  const flat = flattenClaims(output);
  let citations = 0;
  let ungrounded = 0;
  for (const c of flat) {
    citations += c.citations.length;
    if (c.citations.length === 0) ungrounded += 1;
  }
  return { claims: flat.length, citations, ungrounded };
};

/** Returns the unique meeting + turn ids referenced by a ModuleOutput. */
export const collectCitationTurnIds = (output: ModuleOutput): ReadonlyArray<string> => {
  const out = new Set<string>();
  for (const claim of flattenClaims(output)) {
    for (const c of claim.citations) {
      if (c.turnId) out.add(c.turnId);
    }
  }
  return Array.from(out);
};
