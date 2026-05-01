/**
 * DSAR export reader — Story 14.1.
 *
 * Walks the erasure-cascade registry from a single tenant context (set
 * by the worker handler's outer `withJobContext`) and assembles the
 * authed user's data into a typed `DsarPayload` bundle. The bundle is
 * what the worker serializes into the zip; one JSON file per table.
 *
 * Design notes:
 *   - Plain objects only: the bundle is JSON-serializable. We don't
 *     leak Drizzle types or `Date` objects (everything goes through
 *     `toISOString()` at serialize time inside the handler).
 *   - The reader filters per-user where it makes sense (e.g. meetings
 *     owned by the user, audit_logs whose actor is the user) and
 *     per-tenant where the row is shared (the tenant row itself, the
 *     user_preferences for the user).
 *   - The shape mirrors the erasure-cascade.ts registry table set, so
 *     a new tenant-scoped table that lands later only needs one new
 *     query here + one entry in the bundle map.
 */

import type { Db } from '@aisecretary/db';
import {
  auditLogs,
  consents,
  dsarRequests,
  feedbackThumbs,
  meetings,
  notifications,
  recordings,
  speakerTurns,
  tenantInvites,
  tenants,
  userPreferences,
  users,
} from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Plain-JSON bundle returned by the reader. One key per registered
 * tenant-scoped table. Keys mirror the camelCased schema names so the
 * handler can iterate without re-mapping.
 */
export interface DsarPayload {
  tenant: Array<Record<string, unknown>>;
  user: Array<Record<string, unknown>>;
  meetings: Array<Record<string, unknown>>;
  recordings: Array<Record<string, unknown>>;
  speakerTurns: Array<Record<string, unknown>>;
  consents: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  userPreferences: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  feedbackThumbs: Array<Record<string, unknown>>;
  invites: Array<Record<string, unknown>>;
  dsarRequests: Array<Record<string, unknown>>;
}

export interface DsarExportReader {
  readUserData(tenantId: string, userId: string): Promise<DsarPayload>;
}

/**
 * Convert a Drizzle row to a plain object suitable for JSON
 * serialization. Date fields become ISO 8601 strings; Buffer / nested
 * jsonb stays as-is (already JSON-native).
 */
const toPlain = (row: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
};

const mapAll = (rows: ReadonlyArray<Record<string, unknown>>): Array<Record<string, unknown>> =>
  rows.map(toPlain);

export class DrizzleDsarExportReader implements DsarExportReader {
  constructor(private readonly db: Db) {}

  /**
   * The caller wraps this in `withJobContext({ tenantId, region }, …)`
   * so RLS sees the right tenant. We don't open our own transaction
   * here; we run inside the parent's.
   */
  async readUserData(tenantId: string, userId: string): Promise<DsarPayload> {
    // 1. Tenant row — singleton (the user's tenant).
    const tenantRows = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));

    // 2. User row.
    const userRows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));

    // 3. Meetings owned by the user.
    const meetingRows = await this.db
      .select()
      .from(meetings)
      .where(and(eq(meetings.tenantId, tenantId), eq(meetings.ownerUserId, userId)));

    const ownedMeetingIds = meetingRows.map((m) => m.id);

    // 4. Recordings owned by the user.
    const recordingRows = await this.db
      .select()
      .from(recordings)
      .where(and(eq(recordings.tenantId, tenantId), eq(recordings.ownerUserId, userId)));

    // 5. Speaker turns for owned meetings. We loop because drizzle's
    // inArray with an empty list errors out.
    const speakerTurnRows: Array<Record<string, unknown>> = [];
    for (const meetingId of ownedMeetingIds) {
      const rows = await this.db
        .select()
        .from(speakerTurns)
        .where(and(eq(speakerTurns.tenantId, tenantId), eq(speakerTurns.meetingId, meetingId)));
      for (const r of rows) speakerTurnRows.push(r as Record<string, unknown>);
    }

    // 6. Consents acknowledged by the user (recipient_id = userId) +
    // consents tied to meetings the user owns.
    const consentRecipientRows = await this.db
      .select()
      .from(consents)
      .where(and(eq(consents.tenantId, tenantId), eq(consents.recipientId, userId)));
    const consentMeetingRows: Array<Record<string, unknown>> = [];
    for (const meetingId of ownedMeetingIds) {
      const rows = await this.db
        .select()
        .from(consents)
        .where(and(eq(consents.tenantId, tenantId), eq(consents.meetingId, meetingId)));
      for (const r of rows) consentMeetingRows.push(r as Record<string, unknown>);
    }
    const allConsentRows = [...consentRecipientRows, ...consentMeetingRows];
    // Dedup by id.
    const consentSeen = new Set<string>();
    const dedupedConsents: Array<Record<string, unknown>> = [];
    for (const r of allConsentRows) {
      const id = String(r.id);
      if (consentSeen.has(id)) continue;
      consentSeen.add(id);
      dedupedConsents.push(r);
    }

    // 7. Notifications — recipient is opaque text (userId for push, email for email).
    // We match by the user id; emails of the user are out of scope here
    // because the recipient column does not normalize across channels.
    const notificationRows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.recipient, userId)));

    // 8. user_preferences row(s) for the user.
    const userPrefRows = await this.db
      .select()
      .from(userPreferences)
      .where(and(eq(userPreferences.tenantId, tenantId), eq(userPreferences.userId, userId)));

    // 9. Audit logs where the actor is the user.
    const auditRows = await this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.actorUserId, userId)));

    // 10. Feedback thumbs by the user.
    const feedbackRows = await this.db
      .select()
      .from(feedbackThumbs)
      .where(and(eq(feedbackThumbs.tenantId, tenantId), eq(feedbackThumbs.userId, userId)));

    // 11. Invites the user accepted (acceptedByUserId) + invites the
    // user created (invitedByUserId).
    const invitesAccepted = await this.db
      .select()
      .from(tenantInvites)
      .where(and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.acceptedByUserId, userId)));
    const invitesCreated = await this.db
      .select()
      .from(tenantInvites)
      .where(and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.invitedByUserId, userId)));
    const inviteSeen = new Set<string>();
    const dedupedInvites: Array<Record<string, unknown>> = [];
    for (const r of [...invitesAccepted, ...invitesCreated]) {
      const id = String((r as { id: unknown }).id);
      if (inviteSeen.has(id)) continue;
      inviteSeen.add(id);
      dedupedInvites.push(r as Record<string, unknown>);
    }

    // 12. The user's own DSAR-request history.
    const dsarRows = await this.db
      .select()
      .from(dsarRequests)
      .where(and(eq(dsarRequests.tenantId, tenantId), eq(dsarRequests.userId, userId)));

    return {
      tenant: mapAll(tenantRows as Array<Record<string, unknown>>),
      user: mapAll(userRows as Array<Record<string, unknown>>),
      meetings: mapAll(meetingRows as Array<Record<string, unknown>>),
      recordings: mapAll(recordingRows as Array<Record<string, unknown>>),
      speakerTurns: mapAll(speakerTurnRows),
      consents: mapAll(dedupedConsents),
      notifications: mapAll(notificationRows as Array<Record<string, unknown>>),
      userPreferences: mapAll(userPrefRows as Array<Record<string, unknown>>),
      auditLogs: mapAll(auditRows as Array<Record<string, unknown>>),
      feedbackThumbs: mapAll(feedbackRows as Array<Record<string, unknown>>),
      invites: mapAll(dedupedInvites),
      dsarRequests: mapAll(dsarRows as Array<Record<string, unknown>>),
    };
  }
}
