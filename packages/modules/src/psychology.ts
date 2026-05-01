/**
 * Psychology module — Story 5.7.
 *
 * Vertical-specific output: session themes + therapeutic alliance read.
 * Reflective register per UX spec — therapist-facing surfaces require
 * caution and humility. Routes via the HIPAA provider chain (Bedrock
 * primary; per-tenant compliance posture in `packages/llm-gateway`).
 *
 * IMPORTANT: like the medical module, this is conservative on confidence.
 * The therapist signs the note; the AI's read is a draft they can amend.
 * `therapeuticAlliance` is OMITTED when the transcript provides no
 * relational signal — emitting a label without evidence is worse than
 * skipping.
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const psychologyOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'psychology' }>
>;

export type PsychologyModuleOutput = Extract<ModuleOutput, { module: 'psychology' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's psychology analyst. Read a verbatim transcript of a \
therapy / counseling session and produce a session note draft a clinician \
will review and sign. Your output is a DRAFT, not a final note.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "psychology",
  "title": "<session number / focus, ≤ 8 words>",
  "summary": "1-2 sentences: clinical impression of the session",
  "bullets": [{ "claim": "...", "citations": [...] }],
  "sessionThemes": [{ "claim": "<theme observed + brief evidence>", "citations": [...] }],
  "therapeuticAlliance": "weak" | "developing" | "strong"
}

REQUIREMENTS:
- Cite every analytic claim with EXACT meetingId / turnId / spanStartMs / spanEndMs.
- Session themes: 2-5 entries surfacing what the session worked on. Examples: "Anxiety surfaced around upcoming family visit; client linked to childhood pattern", "Continued exploration of grief after partner loss".
- \`therapeuticAlliance\`:
    - "weak" → client guarded, frequent topic switches, low engagement.
    - "developing" → growing trust, willing to explore but with hesitation.
    - "strong" → client engages openly, tolerates challenge, takes risks.
  OMIT this field if the transcript provides no clear relational signal — emitting a label without evidence is worse than skipping.
- Risk flags (suicidal ideation, abuse, mandated-reporting triggers) belong in the summary AND should be cited; flag them clearly.

STYLE:
- Reflective. Past tense. Clinically literate but not jargon-heavy.
- Quote client framings verbatim when they are the signal.
- No diagnostic labels the clinician didn't use.
- Tentative language is FINE ("client appeared to..."). Overconfident reads are worse than humble ones.

This is NOT a substitute for clinical judgment. The therapist reviews and signs.`;

export const psychologyModule: ModuleConfig<PsychologyModuleOutput> = {
  id: 'psychology',
  label: 'Psychology',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: psychologyOutputSchema,
  lowConfidenceThreshold: 0.8,
  maxOutputTokens: 2000,
  temperature: 0.15,
};
