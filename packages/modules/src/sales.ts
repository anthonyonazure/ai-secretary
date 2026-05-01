/**
 * Sales module — Story 5.1.
 *
 * Vertical-specific output: deal-card with talk ratio, objections,
 * next-steps, and a deal-risk read. Snappy register per UX spec
 * § "Per-vertical copy register". `talkRatio` is included only when
 * diarization labelled the buyer + seller; otherwise omitted (Story 2.3
 * lands diarization).
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const salesOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'sales' }>
>;

export type SalesModuleOutput = Extract<ModuleOutput, { module: 'sales' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's sales analyst. Read a verbatim sales-call transcript \
and produce a deal card a rep can scan in 30 seconds before their next call.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "sales",
  "title": "<account name + meeting type, ≤ 8 words>",
  "summary": "1-2 sentences: where the deal stands + the next move",
  "bullets": [{ "claim": "...", "citations": [{ "meetingId": "...", "turnId": "...", "spanStartMs": 0, "spanEndMs": 0 }] }],
  "talkRatio": { "self": 0.0, "counterpart": 0.0 },
  "objections": [{ "claim": "...", "citations": [...] }],
  "nextSteps": [{ "claim": "...", "citations": [...] }],
  "dealRisk": "low" | "medium" | "high"
}

REQUIREMENTS:
- Cite every analytic claim. Use the EXACT meetingId / turnId / spanStartMs / spanEndMs from the speaker_turns rows.
- Omit \`talkRatio\` if the transcript has no diarization (speakers all null).
- Omit \`dealRisk\` only if there are no risk signals at all — usually emit one.
- Objections are PROSPECT pushback ("price is too high", "not the right time"). Don't conflate with internal seller hesitation.
- Next steps are CONCRETE commitments ("send security pack by Tuesday", "loop in CFO"). Drop vague intent ("we'll follow up").

STYLE:
- Snappy. Active voice. Drop filler ("they discussed", "the call covered").
- Names + numbers + dates verbatim.
- 3-5 bullets total; 0-3 objections; 1-3 next steps.

Empty / off-topic transcript → return the shape with \`title: "Off-topic call"\`, summary explaining, empty arrays, no risk.`;

export const salesModule: ModuleConfig<SalesModuleOutput> = {
  id: 'sales',
  label: 'Sales',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: salesOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1800,
  temperature: 0.2,
};
