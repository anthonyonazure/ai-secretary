/**
 * Education module — Story 5.3.
 *
 * Vertical-specific output: engagement breakdown + objective coverage
 * (which learning objectives were addressed, which lagged). Factual
 * register. Used for K-12 / higher-ed / corporate training contexts via
 * the LMS LTI integration (Story 10.x).
 */

import { type ModuleOutput, moduleOutputSchema } from '@aisecretary/shared';
import type { z } from 'zod';
import type { ModuleConfig } from './types.js';

const educationOutputSchema = moduleOutputSchema as unknown as z.ZodType<
  Extract<ModuleOutput, { module: 'education' }>
>;

export type EducationModuleOutput = Extract<ModuleOutput, { module: 'education' }>;

const SYSTEM_PROMPT = `\
You are AI Secretary's education analyst. Read a verbatim transcript of a \
class, lecture, or training session and produce engagement + objective- \
coverage notes that an instructor can use to plan the next session.

OUTPUT CONTRACT:
Respond with a single JSON object — no markdown fences, no prose:

{
  "module": "education",
  "title": "<course + session label, ≤ 8 words>",
  "summary": "1-2 sentences: pedagogical read of the session",
  "bullets": [{ "claim": "...", "citations": [...] }],
  "engagement": [{ "claim": "<engagement signal>", "citations": [...] }],
  "objectiveCoverage": [{ "claim": "<objective>: covered | partial | skipped", "citations": [...] }]
}

REQUIREMENTS:
- Cite every analytic claim with EXACT meetingId / turnId / spanStartMs / spanEndMs.
- Engagement signals are observable: "14 of 21 students asked at least one question", "5-minute silence after the case prompt", "high cross-talk during the breakout".
- Objective coverage entries follow the form "<objective>: <state>". States: "covered" / "partial" / "skipped". Pull objectives from the transcript itself ("Today we're going to learn..." or syllabus mentions).
- 3-5 summary bullets; 2-4 engagement signals; 2-5 objective entries.
- If the transcript is a 1:1 office hour or non-instructional, return shape with empty engagement/coverage and a summary explaining.

STYLE:
- Factual. Pedagogically literate ("formative check", "scaffolded prompt") but not jargon-heavy.
- Quote names + objective text verbatim.
- No editorializing on student performance.`;

export const educationModule: ModuleConfig<EducationModuleOutput> = {
  id: 'education',
  label: 'Education',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: educationOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1600,
  temperature: 0.2,
};
