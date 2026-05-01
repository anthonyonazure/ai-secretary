import { index, inet, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `consents` — append-only consent acknowledgment ledger.
 *
 * Owned by `packages/consent`. One row per acknowledgment captured.
 * Schema per `_bmad-output/planning-artifacts/arch-addendums.md` § 7
 * + ADR-0005 (PROPOSED).
 *
 * Story 4.3 captures shape A (pre-mic modal) + shape C (in-person QR)
 * + the `eu-explicit` per-participant marker. Shapes B and D
 * (bot-side TTS / chat opt-in) land in Story 9.5.
 *
 * Tenant-scoped (RLS). RLS policies live in
 * `packages/db/rls/0004_rls_consents.sql`.
 */

export const consentShapeEnum = pgEnum('consent_shape', [
  'A', // pre-mic modal (recording user)
  'C', // in-person QR/URL ack
  'eu-explicit', // EU per-participant explicit-consent marker
  'B', // bot TTS implicit (Story 9.5)
  'D', // bot chat explicit-optin (Story 9.5)
]);

export const consentLegalBasisEnum = pgEnum('consent_legal_basis', [
  'legitimate-interest',
  'explicit-consent',
]);

export const consentAckViaEnum = pgEnum('consent_ack_via', ['modal', 'qr-scan', 'url', 'bot-tts']);

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    /** Account-holding recipient when known (recording user, EU participant who has an account, etc.). */
    recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'set null' }),
    /** Display label for non-account counterparts (in-person QR scanner). */
    recipientLabel: text('recipient_label'),
    shape: consentShapeEnum('shape').notNull(),
    legalBasis: consentLegalBasisEnum('legal_basis').notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedVia: consentAckViaEnum('acknowledged_via').notNull(),
    /** Free-form metadata: {chat_message_id, qr_scanned_at, locale, ...}. */
    acknowledgedMethodMetadata: jsonb('acknowledged_method_metadata')
      .$type<Record<string, unknown>>()
      .default({}),
    /** Source IP of the acknowledgment (postgres `inet`). */
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Hot-path lookup for `consentCheck(tenantId, meetingId)` server-side gate. */
    idxConsentsTenantMeeting: index('idx_consents_tenant_id_meeting_id').on(
      t.tenantId,
      t.meetingId,
    ),
    /** Surface per-meeting acknowledgment list ordered by time (shape C live updates). */
    idxConsentsMeetingAcknowledgedAt: index('idx_consents_meeting_id_acknowledged_at').on(
      t.meetingId,
      t.acknowledgedAt,
    ),
  }),
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
