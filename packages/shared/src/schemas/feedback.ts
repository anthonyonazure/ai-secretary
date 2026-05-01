import { z } from 'zod';

/**
 * Wire contract for the feedback API surface (Story 1.7).
 *
 * apps/api implements:
 *   - POST /api/v1/feedback/thumbs
 *
 * Captures the per-meeting thumbs-up / thumbs-down receipt prompt that
 * appears on the first three receipts (and any general-purpose feedback
 * follow-up).
 */

export const thumbsResponseValueSchema = z.enum(['up', 'down']);
export type ThumbsResponseValue = z.infer<typeof thumbsResponseValueSchema>;

export const thumbsContextSchema = z.enum(['first-three', 'general']);
export type ThumbsContext = z.infer<typeof thumbsContextSchema>;

export const recordThumbsRequestSchema = z.object({
  meetingId: z.string().uuid(),
  response: thumbsResponseValueSchema,
  context: thumbsContextSchema.optional(),
});
export type RecordThumbsRequest = z.infer<typeof recordThumbsRequestSchema>;

export const recordThumbsResponseSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  response: thumbsResponseValueSchema,
  context: thumbsContextSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type RecordThumbsResponse = z.infer<typeof recordThumbsResponseSchema>;
