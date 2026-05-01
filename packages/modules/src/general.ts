/**
 * General module — Story 3.1 (canonical "any meeting → quick read").
 *
 * Module #1 of the 8-vertical fleet. Used as:
 *   - Default analysis when a meeting has no vertical assigned.
 *   - Fallback when a vertical-specific module returns low confidence.
 *   - The shape every other vertical extends (title + summary + bullets).
 *
 * The system prompt below frames a generic meeting summarizer:
 *   - Output a tight title (≤ 8 words).
 *   - Write a 1-3 sentence summary.
 *   - Produce 3-5 bullets, each grounded in 1-3 citations referencing
 *     `(meetingId, turnId)` per the Story 3.5 deep-link contract.
 *   - Reply with JSON only — the gateway parses against `moduleOutputSchema`.
 *
 * Confidence threshold of 0.7 matches the AnalysisCard low-confidence
 * cutoff in the locked UX spec. Token budget of 1500 covers a 3000-word
 * transcript summary comfortably; longer meetings are chunked upstream
 * (Story 5.x). Temperature 0.2 keeps the model deterministic so re-runs
 * don't churn the AnalysisCard for the same input.
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

/**
 * Narrowed schema for the `general` discriminator. The shared
 * `moduleOutputSchema` is a discriminated union; we derive the variant
 * we need so the worker can validate without re-parsing every variant.
 */
const generalOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'general' }>
>;

export type GeneralModuleOutput = Extract<ModuleOutput, { module: 'general' }>;

/**
 * System prompt — kept in one place so prompt-evolution PRs are easy to
 * review. Hard-wraps stay around 80 chars for diff legibility. Token-
 * count audited at ~250 words.
 */
const SYSTEM_PROMPT = `\
You are AI Secretary's general meeting analyst. Your job is to read a \
verbatim transcript of a meeting and produce a concise "quick read" \
that a participant who missed the meeting can absorb in under 60 \
seconds.

OUTPUT CONTRACT:
You must respond with a single JSON object that matches this exact \
shape (no markdown fences, no prose outside the JSON):

{
  "module": "general",
  "title": "<= 8 words, no trailing punctuation",
  "summary": "1-3 sentences summarizing the meeting's purpose + outcome",
  "bullets": [
    {
      "claim": "one factual statement about the meeting",
      "citations": [
        {
          "meetingId": "<the meetingId you were given>",
          "turnId": "<the turn_id of a relevant speaker_turns row>",
          "spanStartMs": <integer ms>,
          "spanEndMs": <integer ms>,
          "speaker": "<optional speaker label or omit>"
        }
      ]
    }
  ]
}

REQUIREMENTS:
- Emit 3-5 bullets. Fewer than 3 = under-extraction; more than 5 = noise.
- Every bullet must carry at least ONE citation. Citations are how the \
  AnalysisCard renders deep-links into the transcript player; without \
  them the bullet is unverifiable and gets dropped.
- Use the EXACT meetingId, turnId, spanStartMs, and spanEndMs values from \
  the speaker_turns rows you were given. Do not invent IDs.
- Prefer citing the earliest turn that supports a claim over the latest.
- If multiple turns support a claim, list up to 3 citations in chronological order.
- Speaker labels in citations are optional — omit when the transcript \
  has speaker = null.

STYLE:
- Active voice. Past tense (the meeting already happened).
- No filler ("the team discussed", "they talked about"). Start with the \
  decision / fact / action itself.
- Names + numbers + dates verbatim. Do not paraphrase quotes.
- If the meeting has no clear outcome, say so plainly in the summary; \
  do not pad.

If the transcript is empty or contains no substantive content, return \
the JSON shape above with title: "Empty meeting", summary explaining \
why, and bullets: [].`;

export const generalModule: ModuleConfig<GeneralModuleOutput> = {
  id: 'general',
  label: 'General',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: generalOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1500,
  temperature: 0.2,
};
