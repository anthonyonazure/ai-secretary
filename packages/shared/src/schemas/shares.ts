import { z } from 'zod';

/**
 * Story 8.x — share-grant wire contract.
 *
 * Mirrors `packages/db/src/schema/shares.ts`. The plaintext token only
 * ever appears on a freshly-created share's response — clients receive it
 * once (to show in a "copy link" UI), the server stores SHA-256.
 *
 * `kind`:
 *   - `meeting`   → entire meeting (transcript + analyses)
 *   - `clip`      → bounded span (clipStartMs..clipEndMs)
 *   - `insight`   → single module output (e.g. just the sales card)
 *   - `token-url` → public read-only URL with no signup; defaults to viewer scope
 */

export const shareKindSchema = z.enum(['meeting', 'clip', 'insight', 'token-url']);
export type ShareKind = z.infer<typeof shareKindSchema>;

export const shareScopeSchema = z.enum(['owner', 'editor', 'viewer']);
export type ShareScope = z.infer<typeof shareScopeSchema>;

const baseCreateRequest = z.object({
  /** Recipient email — required for in-tenant grants, optional for
   *  token-url (the URL is the primary handle in that case). */
  recipientEmail: z.string().email().optional(),
  /** Days until expiry. Default 30, capped at 90. */
  ttlDays: z.number().int().min(1).max(90).optional(),
});

export const createMeetingShareRequestSchema = z.discriminatedUnion('kind', [
  baseCreateRequest.extend({
    kind: z.literal('meeting'),
    scope: shareScopeSchema.default('viewer'),
  }),
  baseCreateRequest.extend({
    kind: z.literal('clip'),
    scope: shareScopeSchema.default('viewer'),
    clipStartMs: z.number().int().nonnegative(),
    clipEndMs: z.number().int().positive(),
  }),
  baseCreateRequest.extend({
    kind: z.literal('insight'),
    scope: shareScopeSchema.default('viewer'),
    insightModuleId: z.string().min(1),
  }),
  baseCreateRequest.extend({
    kind: z.literal('token-url'),
    /** Token-URL kind always issues at viewer scope — no editor/owner via public URL. */
  }),
]);
export type CreateMeetingShareRequest = z.infer<typeof createMeetingShareRequestSchema>;

export const shareSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  kind: shareKindSchema,
  scope: shareScopeSchema,
  recipientEmail: z.string().email().nullable(),
  recipientUserId: z.string().uuid().nullable(),
  /** Plaintext token URL — present ONLY on the create response, never
   *  in subsequent reads. Clients copy + show it once. */
  tokenUrl: z.string().url().optional(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  clipStartMs: z.number().int().nullable(),
  clipEndMs: z.number().int().nullable(),
  insightModuleId: z.string().nullable(),
  crossOrg: z.boolean(),
  createdAt: z.string().datetime(),
  createdBy: z.object({
    userId: z.string().uuid(),
    name: z.string(),
  }),
});
export type Share = z.infer<typeof shareSchema>;

export const sharesListResponseSchema = z.object({
  items: z.array(shareSchema),
  totalCount: z.number().int().nonnegative(),
});
export type SharesListResponse = z.infer<typeof sharesListResponseSchema>;

/**
 * Public token-URL recipient view payload. Auth-free. Returns the scoped
 * subset of the meeting per the share's `kind` + bounds.
 *
 * `kind = 'meeting'`  → full transcript + analyses arrays
 * `kind = 'clip'`     → clip-windowed transcript turns + clip-windowed analyses
 * `kind = 'insight'`  → just the named module's output
 */
export const recipientViewResponseSchema = z.object({
  shareId: z.string().uuid(),
  kind: shareKindSchema,
  meeting: z.object({
    id: z.string().uuid(),
    title: z.string(),
    durationMs: z.number().int().nonnegative().nullable(),
    recordedAt: z.string().datetime().nullable(),
  }),
  /** Filtered by clip bounds when applicable. */
  speakerTurns: z.array(
    z.object({
      turnId: z.string(),
      speaker: z.string().nullable(),
      spanStartMs: z.number().int().nonnegative(),
      spanEndMs: z.number().int().nonnegative(),
      text: z.string(),
    }),
  ),
  /** Filtered to insight-module-id when applicable. */
  moduleOutputs: z.array(
    z.object({
      moduleId: z.string(),
      output: z.unknown(),
      confidence: z.number().nullable(),
    }),
  ),
  /** Display-only org name to show "shared by Acme Corp" — null for
   *  cross-org tokens whose source domain isn't a registered tenant. */
  sourceTenantName: z.string().nullable(),
  expiresAt: z.string().datetime(),
});
export type RecipientViewResponse = z.infer<typeof recipientViewResponseSchema>;
