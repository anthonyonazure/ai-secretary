/**
 * PM module — Story 5.6.
 *
 * Vertical-specific output: decisions log + action items + risks register.
 * Factual register. Used for cross-functional product / engineering /
 * design syncs where the value is "what was decided + what's owned + what
 * could go wrong" rather than narrative prose.
 *
 * Note: this module's `actionItems` slot OVERLAPS with the
 * `extract-action-items` worker handler. Convention: PM-tagged meetings
 * use this module's action-items shape (with risks); other verticals use
 * the standalone action-items extractor for ownership-only.
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const pmOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'pm' }>
>;

export type PmModuleOutput = Extract<ModuleOutput, { module: 'pm' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's product analyst. Read a verbatim transcript of a \
PM / engineering / design sync and produce a decisions-log-style summary \
with action items and risks.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "pm",
  "title": "<initiative + meeting type, ≤ 8 words>",
  "summary": "1-2 sentences: what was decided + the next milestone",
  "bullets": [{ "claim": "...", "citations": [...] }],
  "decisions": [{ "claim": "<decision + rationale, single sentence>", "citations": [...] }],
  "actionItems": [{ "claim": "<verb + scope, with owner + due date when stated>", "citations": [...] }],
  "risks": [{ "claim": "<risk description>", "citations": [...] }]
}

REQUIREMENTS:
- Cite every decision, action item, and risk with EXACT meetingId / turnId / spanStartMs / spanEndMs.
- A decision is irreversible-feeling commitment ("We're going with Postgres for the queue"). Open questions are NOT decisions.
- Action items are SPECIFIC: imperative voice, owner-named when stated, due-date verbatim. "Decide approach by EOW" is fine when no owner.
- Risks are items that could derail the milestone: dependency slippage, capacity, scope creep, technical unknowns, regulatory / security concerns.
- 3-5 summary bullets; 1-5 decisions; 1-7 action items; 0-5 risks.
- A meeting that produces zero decisions and zero action items is a smell — surface that in the summary.

STYLE:
- Factual. Active voice. No marketing language.
- Names + projects + dates verbatim.
- Don't invent decisions that the meeting deferred. "Discussed pricing" is not a decision.`;

export const pmModule: ModuleConfig<PmModuleOutput> = {
  id: 'pm',
  label: 'PM',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: pmOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1800,
  temperature: 0.2,
};
