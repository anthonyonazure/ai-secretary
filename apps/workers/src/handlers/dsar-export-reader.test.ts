/**
 * Story 14.1 — DsarExportReader unit tests.
 *
 * Verifies the Drizzle reader walks every registered tenant-scoped
 * table once and bundles the rows into the typed DsarPayload shape.
 *
 * The Db handle is faked: every `select().from(<table>)` call is
 * intercepted and the table's mock row set is returned. We assert the
 * resulting bundle has one entry per registered key + that the row
 * shapes round-trip Date → ISO string for JSON serialization.
 */

import type { Db } from '@aisecretary/db';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleDsarExportReader } from './dsar-export-reader.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const MEETING_ID = '33333333-3333-4333-8333-333333333333';

interface MockRowSet {
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

/**
 * Build a faked Drizzle Db where each select-by-table-name call returns
 * a pre-canned row set. We tag each call by the underlying drizzle
 * symbol-key on the table object — easier: just rotate through the
 * expected query order in the reader implementation.
 */
const buildFakeDb = (rowSet: MockRowSet): Db => {
  // The reader makes these queries in order:
  //   1. tenants
  //   2. users
  //   3. meetings (owned by user)
  //   4. recordings (owned by user)
  //   5. for each owned meeting: speaker_turns
  //   6. consents recipient_id = userId
  //   7. for each owned meeting: consents meeting_id
  //   8. notifications recipient = userId
  //   9. user_preferences user_id = userId
  //  10. audit_logs actor_user_id = userId
  //  11. feedback_thumbs user_id = userId
  //  12. tenant_invites accepted_by_user_id
  //  13. tenant_invites invited_by_user_id
  //  14. dsar_requests user_id = userId

  const orderedResponses: Array<Array<Record<string, unknown>>> = [
    rowSet.tenant,
    rowSet.user,
    rowSet.meetings,
    rowSet.recordings,
    // one speaker-turns query per meeting:
    ...rowSet.meetings.map(() => rowSet.speakerTurns),
    rowSet.consents, // recipient_id branch — we return the full set; reader dedups
    // one consent meeting query per meeting:
    ...rowSet.meetings.map(() => [] as Array<Record<string, unknown>>),
    rowSet.notifications,
    rowSet.userPreferences,
    rowSet.auditLogs,
    rowSet.feedbackThumbs,
    rowSet.invites, // accepted_by branch
    [], // invited_by branch
    rowSet.dsarRequests,
  ];

  let callIndex = 0;
  const next = (): Array<Record<string, unknown>> => {
    const idx = callIndex;
    callIndex += 1;
    return orderedResponses[idx] ?? [];
  };

  const fakeDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => next()),
      })),
    })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
  } as unknown as Db;

  return fakeDb;
};

describe('DrizzleDsarExportReader', () => {
  it('returns a payload with a key per registered table', async () => {
    const createdAt = new Date('2026-04-29T00:00:00Z');
    const rowSet: MockRowSet = {
      tenant: [{ id: TENANT_ID, name: 'Acme', createdAt }],
      user: [{ id: USER_ID, tenantId: TENANT_ID, email: 'u@a.test', name: 'U', createdAt }],
      meetings: [{ id: MEETING_ID, tenantId: TENANT_ID, ownerUserId: USER_ID, createdAt }],
      recordings: [
        { id: 'rec-1', tenantId: TENANT_ID, ownerUserId: USER_ID, storageKey: 'k', createdAt },
      ],
      speakerTurns: [
        { id: 'st-1', tenantId: TENANT_ID, meetingId: MEETING_ID, text: 'hi', createdAt },
      ],
      consents: [
        {
          id: 'c-1',
          tenantId: TENANT_ID,
          meetingId: MEETING_ID,
          recipientId: USER_ID,
          acknowledgedAt: createdAt,
          createdAt,
        },
      ],
      notifications: [
        { id: 'n-1', tenantId: TENANT_ID, recipient: USER_ID, kind: 'dsar-ready', createdAt },
      ],
      userPreferences: [
        {
          id: 'up-1',
          tenantId: TENANT_ID,
          userId: USER_ID,
          channel: 'email',
          kind: 'x',
          createdAt,
        },
      ],
      auditLogs: [
        {
          id: 'a-1',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          action: 'dsar.requested',
          resourceType: 'dsar',
          createdAt,
        },
      ],
      feedbackThumbs: [
        {
          id: 'f-1',
          tenantId: TENANT_ID,
          userId: USER_ID,
          meetingId: MEETING_ID,
          response: 'up',
          createdAt,
        },
      ],
      invites: [
        {
          id: 'i-1',
          tenantId: TENANT_ID,
          acceptedByUserId: USER_ID,
          invitedByUserId: 'other',
          email: 'x@y.test',
          createdAt,
        },
      ],
      dsarRequests: [
        { id: 'd-1', tenantId: TENANT_ID, userId: USER_ID, status: 'ready', createdAt },
      ],
    };
    const db = buildFakeDb(rowSet);
    const reader = new DrizzleDsarExportReader(db);

    const payload = await reader.readUserData(TENANT_ID, USER_ID);

    expect(payload.tenant).toHaveLength(1);
    expect(payload.user).toHaveLength(1);
    expect(payload.meetings).toHaveLength(1);
    expect(payload.recordings).toHaveLength(1);
    expect(payload.speakerTurns).toHaveLength(1);
    expect(payload.consents).toHaveLength(1);
    expect(payload.notifications).toHaveLength(1);
    expect(payload.userPreferences).toHaveLength(1);
    expect(payload.auditLogs).toHaveLength(1);
    expect(payload.feedbackThumbs).toHaveLength(1);
    expect(payload.invites).toHaveLength(1);
    expect(payload.dsarRequests).toHaveLength(1);

    // Date → ISO string normalization: the bundle must JSON-serialize
    // without losing the timestamp shape.
    expect(payload.tenant[0]?.createdAt).toBe(createdAt.toISOString());
    expect(payload.dsarRequests[0]?.createdAt).toBe(createdAt.toISOString());
  });

  it('handles a user with zero meetings without erroring', async () => {
    const rowSet: MockRowSet = {
      tenant: [{ id: TENANT_ID }],
      user: [{ id: USER_ID }],
      meetings: [],
      recordings: [],
      speakerTurns: [],
      consents: [],
      notifications: [],
      userPreferences: [],
      auditLogs: [],
      feedbackThumbs: [],
      invites: [],
      dsarRequests: [],
    };
    const db = buildFakeDb(rowSet);
    const reader = new DrizzleDsarExportReader(db);

    const payload = await reader.readUserData(TENANT_ID, USER_ID);
    expect(payload.meetings).toHaveLength(0);
    expect(payload.speakerTurns).toHaveLength(0);
    expect(payload.consents).toHaveLength(0);
  });
});
