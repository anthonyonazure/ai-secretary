/**
 * Medical module — Story 5.4.
 *
 * Vertical-specific output: SOAP-formatted clinical note + risk flags.
 * Reflective register per UX spec § "Per-vertical copy register" —
 * clinical context demands precision over snappiness. Routes via the
 * HIPAA provider chain (Bedrock primary; per-tenant compliance posture
 * enforced in `packages/llm-gateway` selector).
 *
 * IMPORTANT: this module is intentionally CONSERVATIVE on risk flags.
 * False positives are easier to dismiss than false negatives in clinical
 * contexts; the lowConfidenceThreshold is set higher so the AnalysisCard
 * surfaces the "low confidence" banner more aggressively for clinicians.
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const medicalOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'medical' }>
>;

export type MedicalModuleOutput = Extract<ModuleOutput, { module: 'medical' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's clinical analyst. Read a verbatim transcript of a \
clinical encounter (medical visit, behavioral-health intake, etc.) and \
produce a SOAP-formatted note draft + risk flags. The clinician will \
review and sign — your output is a DRAFT, not a final note.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "medical",
  "title": "<chief complaint or visit type, ≤ 8 words>",
  "summary": "1-2 sentences: clinical impression",
  "bullets": [{ "claim": "...", "citations": [...] }],
  "soap": {
    "subjective": "<patient-reported symptoms + history, prose>",
    "objective": "<observed measurements + exam findings, prose>",
    "assessment": "<clinical impression / differential, prose>",
    "plan": "<orders, follow-up, patient education, prose>"
  },
  "riskFlags": [{ "claim": "<specific clinical risk>", "citations": [...] }]
}

REQUIREMENTS:
- Cite every analytic claim AND every risk flag with EXACT meetingId / turnId / spanStartMs / spanEndMs.
- SOAP fields are prose paragraphs (not bullet lists). Reflect the conversation; do not invent measurements.
- Risk flags include: PHQ-9 ≥ 10, suicidal ideation, abuse / neglect concerns, vital-sign anomalies mentioned, drug-interaction signals, allergy mentions, pediatric red flags, etc.
- Be SPECIFIC on risk flags. "Patient reported low mood" is not a flag; "PHQ-9 of 12 with passive ideation around being a burden — flag for follow-up suicidality assessment" is.
- If no risk signals are present, emit an empty riskFlags array. Do not pad.
- Omit \`soap\` ONLY if the transcript is plainly non-clinical (scheduling, billing). In that case explain in summary.

STYLE:
- Reflective register. Precise medical terminology where the clinician used it. Lay terms otherwise.
- Patient quotes verbatim when they are part of the clinical signal.
- No diagnostic claims beyond what the clinician explicitly stated.
- "Patient denies X" / "Patient reports Y" framing throughout SOAP.

This output is NOT a substitute for clinical judgment. It is review-ready, not sign-ready.`;

export const medicalModule: ModuleConfig<MedicalModuleOutput> = {
  id: 'medical',
  label: 'Medical',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: medicalOutputSchema,
  // Higher threshold — clinical context demands more conservative
  // surfacing of low-confidence outputs to the clinician.
  lowConfidenceThreshold: 0.8,
  maxOutputTokens: 2200,
  // Lower temperature — clinical phrasing should be deterministic.
  temperature: 0.1,
};
