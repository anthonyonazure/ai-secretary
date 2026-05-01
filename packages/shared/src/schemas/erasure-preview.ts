/**
 * Erasure-cascade preview wire schemas — Story 14.4 (`DsarQueueItem`
 * cascade-scope preview before commit).
 *
 * Counts how many rows each registered tenant-scoped table would touch
 * if the user-erasure ran right now. The admin sees the preview as a
 * confirmation step ("47 transcripts, 12 summaries, …") before
 * approving the destructive job.
 */

import { z } from 'zod';

export const erasureStrategySchema = z.enum([
  'cascade-source',
  'cascade',
  'soft-delete',
  'shred',
  'redact',
]);
export type ErasureStrategyWire = z.infer<typeof erasureStrategySchema>;

export const erasurePreviewActionSchema = z.enum([
  'shred',
  'redact',
  'soft-delete',
  'cascade-fk',
  'cascade-source-skipped',
  'noop-out-of-scope',
]);
export type ErasurePreviewAction = z.infer<typeof erasurePreviewActionSchema>;

export const erasurePreviewStageSchema = z.object({
  table: z.string(),
  strategy: erasureStrategySchema,
  action: erasurePreviewActionSchema,
  /** Number of rows the action would touch when executed. */
  rowCount: z.number().int().min(0),
  note: z.string().optional(),
});
export type ErasurePreviewStage = z.infer<typeof erasurePreviewStageSchema>;

export const erasurePreviewResponseSchema = z.object({
  scope: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  /** Sum of all `rowCount` values where `action !== 'noop-out-of-scope'`. */
  totalRowsAffected: z.number().int().min(0),
  stages: z.array(erasurePreviewStageSchema),
  /** True when every stage in the cascade had a counter executor. */
  fullyHandled: z.boolean(),
});
export type ErasurePreviewResponse = z.infer<typeof erasurePreviewResponseSchema>;
