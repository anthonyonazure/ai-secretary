/**
 * RAG chat wire schemas — Story 6.1 (FR29 substrate).
 *
 * Streaming chat that grounds answers in the user's corpus via the
 * search endpoint (Story 7.2). The chat endpoint streams a `text/event-
 * stream` response so citation chips populate inline as the answer
 * arrives.
 *
 * Empty-state shapes per UX spec § Step 9 D4 / Step 7 token surface:
 *   - 'confident'  — high-faithfulness answer
 *   - 'low-confidence' — answer + rank-chip "best matches" UI
 *   - 'no-answer' — honest "I don't know" beats hallucination
 *   - 'off-topic' — query is outside the corpus
 */

import { z } from 'zod';
import { citationRefSchema } from './module-output.js';

export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageSchema = z.object({
  role: chatMessageRoleSchema,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  /** The user's prompt — appended to `messages` as the latest user turn. */
  query: z.string().min(1).max(2000),
  /** Prior turns (for multi-turn conversations). Last entry must be `user`. */
  messages: z.array(chatMessageSchema).default([]),
  /** Optional filter — chat against a single meeting only. */
  meetingId: z.string().uuid().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatEmptyStateSchema = z.enum([
  'confident',
  'low-confidence',
  'no-answer',
  'off-topic',
]);
export type ChatEmptyState = z.infer<typeof chatEmptyStateSchema>;

/**
 * One SSE event from the chat endpoint. The endpoint emits these in
 * order:
 *   1. one `retrieval` event with the citation set (so the UI can
 *      render placeholder chips immediately)
 *   2. zero or more `delta` events as the LLM token-streams
 *   3. one `done` event with the empty-state classification + the
 *      faithfulness score
 *
 * Errors arrive as a single `error` event.
 */
export const chatEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('retrieval'),
    citations: z.array(citationRefSchema),
  }),
  z.object({
    kind: z.literal('delta'),
    /** Token chunk to append to the assistant's reply. */
    text: z.string(),
  }),
  z.object({
    kind: z.literal('done'),
    emptyState: chatEmptyStateSchema,
    /** 0..1 faithfulness score; null when no answer was generated. */
    faithfulness: z.number().min(0).max(1).nullable(),
  }),
  z.object({
    kind: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
]);
export type ChatEvent = z.infer<typeof chatEventSchema>;
