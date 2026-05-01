/**
 * Action-items module — Story 3.3 (extract-action-items worker).
 *
 * NOT a vertical analysis module — runs alongside the per-vertical
 * analyzer (general, sales, etc.) and emits a separate row set into
 * the `action_items` table. Kept here so the prompt + output schema
 * live alongside the other module configs (consistent ownership; one
 * grep finds every prompt the platform ships).
 *
 * The output schema below is intentionally narrower than `ModuleOutput`
 * — action items are a flat list, not the AnalysisCard contract.
 */

import { citationRefSchema } from '@aisecretary/shared';
import { z } from 'zod';

/**
 * Per-item schema. Owner + due date are optional — the LLM can leave
 * them null when the transcript doesn't mention an assignee or a date.
 */
export const actionItemSchema = z.object({
  /** The action statement itself — e.g. "Send the SOC 2 questionnaire to Acme by Friday". */
  text: z.string().min(1),
  /**
   * Display name of the person responsible. Free text — the worker
   * resolves to a `users` row downstream when the name matches a
   * tenant member; otherwise the row stays free-text + nullable
   * `owner_user_id`.
   */
  ownerName: z.string().nullable(),
  /**
   * Due date in ISO 8601 (date-only or datetime). Null when no date
   * was discussed.
   */
  dueDate: z.string().nullable(),
  /**
   * Citations grounding the action item in the transcript — same
   * `(meetingId, turnId)` contract as `ModuleOutput.bullets`.
   */
  citations: z.array(citationRefSchema).default([]),
});
export type ActionItem = z.infer<typeof actionItemSchema>;

export const actionItemsOutputSchema = z.object({
  items: z.array(actionItemSchema).default([]),
});
export type ActionItemsOutput = z.infer<typeof actionItemsOutputSchema>;

/**
 * System prompt — stricter than the general module's. We want zero
 * speculation: if the transcript doesn't say "X will do Y", we don't
 * emit an item. Empty array is a valid response.
 */
const SYSTEM_PROMPT = `\
You are AI Secretary's action-item extractor. Your job is to read a \
verbatim transcript of a meeting and emit ONLY explicit, agreed-upon \
action items.

OUTPUT CONTRACT:
Respond with a single JSON object (no markdown fences) of this exact shape:

{
  "items": [
    {
      "text": "<the action — e.g. 'Send the SOC 2 questionnaire to Acme'>",
      "ownerName": "<assignee display name OR null>",
      "dueDate": "<ISO 8601 date or datetime, OR null>",
      "citations": [
        {
          "meetingId": "<the meetingId you were given>",
          "turnId": "<turn_id from a speaker_turns row>",
          "spanStartMs": <integer ms>,
          "spanEndMs": <integer ms>,
          "speaker": "<optional speaker label or omit>"
        }
      ]
    }
  ]
}

REQUIREMENTS:
- Only emit items that are explicitly agreed to in the transcript. \
  Hedged language ("we should think about X", "maybe X") = NOT an item. \
  Direct commitments ("I'll send X by Friday", "Bob will follow up with Y") = item.
- Every item must carry at least ONE citation pointing to the speaker_turn \
  where the commitment was made. Use the exact meetingId, turnId, \
  spanStartMs, and spanEndMs values from the speaker_turns you were given.
- ownerName: copy the speaker's name verbatim from the transcript when \
  the speaker volunteered ("I'll do X") OR was assigned ("Bob, can you do X?"). \
  Use null when no clear owner.
- dueDate: parse to ISO 8601. Relative dates ("by Friday", "next week") \
  must be converted using the meeting's startedAt timestamp as the \
  reference; you will be given that in the user message. Use null when \
  no date was mentioned.
- It is correct to return { "items": [] } when the meeting contained \
  no commitments. Do not pad.
- Maximum 20 items per meeting — if more are present, surface only the \
  20 highest-priority (those with explicit owner + date).

STYLE:
- Imperative voice for the text field ("Send X to Y", not "I will send X to Y").
- Names + numbers + dates verbatim.
- Do not duplicate the same commitment in two items.`;

export interface ActionItemsModuleConfig {
  id: 'action-items';
  label: string;
  systemPrompt: string;
  // Use zod's inferred schema type directly — the discriminated `ZodType<T>`
  // generic doesn't unify with `ZodObject` schemas that carry `.default()`
  // fields. Consumers that need the output type use `ActionItemsOutput`
  // (the inferred type) rather than narrowing the schema.
  outputSchema: typeof actionItemsOutputSchema;
  lowConfidenceThreshold: number;
  maxOutputTokens: number;
  temperature: number;
}

export const actionItemsModule: ActionItemsModuleConfig = {
  id: 'action-items',
  label: 'Action items',
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: actionItemsOutputSchema,
  lowConfidenceThreshold: 0.7,
  maxOutputTokens: 1000,
  temperature: 0.1,
};
