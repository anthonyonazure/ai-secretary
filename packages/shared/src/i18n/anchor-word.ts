import type { ModuleId } from '../schemas/module-output.js';

/**
 * Story 1.9 — per-vertical anchor word substrate.
 *
 * The "anchor word" is the core noun used in product copy when referring
 * to "the thing produced from a meeting". Provisional default is
 * `"receipt"` (en) / `"reçu"` (fr) per UX spec § "Receipt as anchor".
 * Clinical / education override the default with vertical-specific
 * vocabulary (`"session note"` / `"compte rendu"`).
 *
 * Pre-launch card-sort (per
 * `_bmad-output/planning-artifacts/open-work/card-sort-plan.md`) may
 * flip the default to `"brief"` / `"debrief"` / `"dossier"` / `"wrap"`.
 * This file is the single edit-point for that change.
 */

export type SupportedLocale = 'en' | 'fr';

export const supportedLocales: ReadonlyArray<SupportedLocale> = ['en', 'fr'];

const TABLE: Record<ModuleId, Record<SupportedLocale, string>> = {
  general: { en: 'receipt', fr: 'reçu' },
  sales: { en: 'receipt', fr: 'reçu' },
  hr: { en: 'receipt', fr: 'reçu' },
  education: { en: 'session note', fr: 'compte rendu' },
  medical: { en: 'session note', fr: 'compte rendu' },
  support: { en: 'receipt', fr: 'reçu' },
  pm: { en: 'receipt', fr: 'reçu' },
  psychology: { en: 'session note', fr: 'compte rendu' },
};

export interface AnchorWordInput {
  locale: SupportedLocale;
  vertical?: ModuleId;
}

/**
 * Resolves the anchor word for a `(locale, vertical)` pair. When
 * `vertical` is omitted (or unrecognised) we fall back to `general`,
 * which maps to the platform-wide default.
 */
export function anchorWord(input: AnchorWordInput): string {
  const vertical = input.vertical && input.vertical in TABLE ? input.vertical : 'general';
  return TABLE[vertical][input.locale];
}

/**
 * Locale-only fallback when the surface doesn't know the active vertical.
 */
export function defaultAnchorWord(locale: SupportedLocale): string {
  return TABLE.general[locale];
}

/**
 * Internal table reference — exported only for tests so they can iterate
 * the full coverage matrix without hard-coding it.
 */
export const __anchorWordTable: typeof TABLE = TABLE;
