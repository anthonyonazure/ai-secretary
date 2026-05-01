/**
 * `@aisecretary/modules` — vertical-analysis module configs.
 *
 * Per CLAUDE.md "Module = config, not code": every vertical (general,
 * sales, hr, education, medical, support, pm, psychology) lives as one
 * file under `packages/modules/src/<id>.ts` exporting a `ModuleConfig`.
 * Adding a vertical is a config-only change — no code paths fork.
 *
 * The `outputSchema` is pulled directly from
 * `@aisecretary/shared/schemas/module-output` so the discriminated
 * `ModuleOutput` union stays the single contract surface for the
 * worker pipeline + AnalysisCard renderer.
 */

import type { ModuleId, ModuleOutput } from '@aisecretary/shared';
import type { z } from 'zod';

export interface ModuleConfig<TOutput extends ModuleOutput = ModuleOutput> {
  /** Discriminator — matches the `module` field on the output variant. */
  id: ModuleId;
  /** Human-readable label — used in audit-log entries + provider prompt context. */
  label: string;
  /**
   * System prompt that frames the LLM. Should reference the speaker-turn
   * citation contract `(meetingId, turnId)` when bullets must cite
   * transcript spans (per Story 3.5 + `citationRefSchema`).
   */
  systemPrompt: string;
  /** Zod schema the LLM output must conform to. The gateway parses against this. */
  outputSchema: z.ZodType<TOutput>;
  /**
   * Confidence threshold below which the AnalysisCard renders the
   * low-confidence banner. Module-specific because different verticals
   * have different "good enough" bars.
   */
  lowConfidenceThreshold: number;
  /** Maximum output tokens — sets the LLM token budget. */
  maxOutputTokens: number;
  /** Default temperature — module-specific. */
  temperature: number;
}
