/**
 * Zod mirrors of the public `types.ts` contracts. Used by the future
 * `consent-check` Fastify plugin (Story 1.4 follow-up) and by
 * persistence boundaries that need runtime validation.
 */

import { z } from 'zod';

export const participantRegionSchema = z.enum(['us', 'eu', 'unknown']);

export const consentLegalBasisSchema = z.enum(['legitimate-interest', 'explicit-consent']);

export const consentShapeSchema = z.enum(['A', 'C', 'eu-explicit', 'B', 'D']);

export const meetingSourceSchema = z.enum(['mobile-mic', 'web-mic', 'bot', 'upload']);

export const consentPolicySchema = z.object({
  default: z.enum(['us', 'eu']),
  alwaysExplicit: z.boolean().optional(),
  orgInPersonRequired: z.boolean().optional(),
});

export const consentParticipantInputSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  calendarTimezone: z.string().optional(),
  ipCountry: z.string().length(2).optional(),
});

export const consentRecordSchema = z.object({
  tenantId: z.string().uuid(),
  meetingId: z.string().uuid(),
  recipientId: z.string().uuid().nullable().optional(),
  recipientLabel: z.string().nullable().optional(),
  shape: consentShapeSchema,
  legalBasis: consentLegalBasisSchema,
  acknowledgedAt: z.string().datetime(),
  acknowledgedVia: z.enum(['modal', 'qr-scan', 'url', 'bot-tts']),
  acknowledgedMethodMetadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
});

export type ConsentParticipantInputParsed = z.infer<typeof consentParticipantInputSchema>;
export type ConsentRecordParsed = z.infer<typeof consentRecordSchema>;
