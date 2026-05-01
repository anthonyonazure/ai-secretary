/**
 * `@aisecretary/modules` — vertical-analysis module configs.
 *
 * Public surface (consumers should NOT reach into individual files;
 * everything is re-exported from this index for stability):
 *
 *   - `ModuleConfig`              shape every vertical implements
 *   - `generalModule`             Story 3.1 — canonical "quick read"
 *   - `actionItemsModule`         Story 3.3 — explicit-commitments extractor
 *   - `moduleRegistry`            ModuleId → ModuleConfig lookup map
 *   - `getModuleConfig(id)`       throwing accessor (worker happy path)
 *   - `hasModuleConfig(id)`       cheap presence check (renderer)
 *
 * Per CLAUDE.md "Module = config, not code", adding a new vertical means
 * authoring one file under `src/<id>.ts` + adding one line to
 * `registry.ts`. No code paths fork.
 */

export const PACKAGE_NAME = '@aisecretary/modules';

export type { ModuleConfig } from './types.js';
export { generalModule, type GeneralModuleOutput } from './general.js';
export { salesModule, type SalesModuleOutput } from './sales.js';
export { hrModule, type HrModuleOutput } from './hr.js';
export { educationModule, type EducationModuleOutput } from './education.js';
export { medicalModule, type MedicalModuleOutput } from './medical.js';
export { supportModule, type SupportModuleOutput } from './support.js';
export { pmModule, type PmModuleOutput } from './pm.js';
export { psychologyModule, type PsychologyModuleOutput } from './psychology.js';
export {
  actionItemsModule,
  actionItemsOutputSchema,
  actionItemSchema,
  type ActionItem,
  type ActionItemsModuleConfig,
  type ActionItemsOutput,
} from './action-items.js';
export { moduleRegistry, getModuleConfig, hasModuleConfig } from './registry.js';
export {
  auditCitations,
  auditAllCitations,
  type CitationAuditResult,
  type ClaimAuditEntry,
} from './citation-audit.js';
