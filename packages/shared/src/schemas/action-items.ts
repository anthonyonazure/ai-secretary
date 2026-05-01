/**
 * Action-items wire schemas — Story 8.5 ("My Actions" cross-meeting roll-up).
 *
 * The DB table `action_items` is owned by Story 3.3 (extract-action-items
 * worker writes one row per commitment). This schema is the wire contract
 * the API + web client speak about those rows on the My Actions page.
 *
 * Item lifecycle: `pending → accepted → done | dismissed`. The web UI
 * exposes one-tap mark-done; the rest of the FSM is reserved for the
 * receipt flow + Story 8.6 team-lead view.
 */

import { z } from 'zod';
import { citationRefSchema } from './module-output.js';

export const actionItemStatusSchema = z.enum(['pending', 'accepted', 'done', 'dismissed']);
export type ActionItemStatus = z.infer<typeof actionItemStatusSchema>;

/**
 * Single action item as the My Actions page renders it. Includes the
 * source-meeting backlink shape (id + title + recordedAt) so the client
 * can link without a second round trip.
 */
export const actionItemRowSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  meetingTitle: z.string(),
  meetingRecordedAt: z.string().datetime().nullable(),
  text: z.string(),
  ownerName: z.string().nullable(),
  ownerUserId: z.string().uuid().nullable(),
  dueDate: z.string().datetime().nullable(),
  status: actionItemStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  citations: z.array(citationRefSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActionItemRow = z.infer<typeof actionItemRowSchema>;

export const listActionItemsQuerySchema = z.object({
  /**
   * Filter by status. Comma-separated; default `pending,accepted` (open
   * items only — the My Actions surface defaults to "what's left to do").
   */
  status: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      return s.split(',').map((v) => v.trim()) as ActionItemStatus[];
    })
    .pipe(z.array(actionItemStatusSchema).optional()),
  /** Filter to a single source meeting. */
  meetingId: z.string().uuid().optional(),
  /** ISO date — only items with `dueDate <= dueBefore`. */
  dueBefore: z.string().datetime().optional(),
  /** Cursor pagination — base64-encoded `(updatedAt, id)`. */
  cursor: z.string().optional(),
  /** Page size. */
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListActionItemsQuery = z.infer<typeof listActionItemsQuerySchema>;

export const listActionItemsResponseSchema = z.object({
  items: z.array(actionItemRowSchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().min(0),
});
export type ListActionItemsResponse = z.infer<typeof listActionItemsResponseSchema>;

export const updateActionItemStatusRequestSchema = z.object({
  status: actionItemStatusSchema,
});
export type UpdateActionItemStatusRequest = z.infer<typeof updateActionItemStatusRequestSchema>;
