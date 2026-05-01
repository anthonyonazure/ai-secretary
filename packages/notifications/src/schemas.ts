import { z } from 'zod';

/**
 * Zod schemas mirroring the type surface in `types.ts`. Every
 * job-payload boundary (pg-boss `notification.send` handler, API
 * routes that enqueue notifications) parses through these before
 * touching the gateway.
 */

export const notificationChannelSchema = z.enum(['push', 'email']);

export const notificationKindSchema = z.enum([
  're-engagement-24h',
  're-engagement-72h',
  'capture-at-risk',
  'upload-retry-exhausted',
  'bot-join-failed',
  'trial-ending-soon',
  'trial-expired',
  'dsar-ready',
  'dsar-failed',
  'share-received-slack',
  'share-received-teams',
  'analysis-completed',
  'tenant-invite',
  // Story 15.x — hub-app dispatch event types
  'meeting-receipt-slack',
  'meeting-receipt-teams',
  'meeting-receipt-crm-note',
  'lms-grade-passback',
  'lms-deeplink-launched',
]);

export const emailProviderIdSchema = z.enum(['postmark', 'ses', 'smtp']);

export const pushRecipientSchema = z.object({
  channel: z.literal('push'),
  userId: z.string().uuid(),
  pushTokens: z.array(z.string().min(1)).min(1),
});

export const emailRecipientSchema = z.object({
  channel: z.literal('email'),
  email: z.string().email(),
  userId: z.string().uuid().optional(),
  name: z.string().optional(),
});

export const notificationRecipientSchema = z.discriminatedUnion('channel', [
  pushRecipientSchema,
  emailRecipientSchema,
]);

export const pushPayloadSchema = z.object({
  channel: z.literal('push'),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const emailPayloadSchema = z.object({
  channel: z.literal('email'),
  locale: z.string().optional(),
  context: z.record(z.unknown()),
  from: z.string().optional(),
});

export const notificationPayloadSchema = z.discriminatedUnion('channel', [
  pushPayloadSchema,
  emailPayloadSchema,
]);

export const notificationRequestSchema = z.object({
  tenantId: z.string().uuid(),
  kind: notificationKindSchema,
  recipient: notificationRecipientSchema,
  payload: notificationPayloadSchema,
  dedupKey: z.string().optional(),
});

export type NotificationRequestInput = z.infer<typeof notificationRequestSchema>;
