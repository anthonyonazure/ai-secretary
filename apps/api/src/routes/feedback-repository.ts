/**
 * Repository seam for the feedback routes (Story 1.7).
 *
 * Production wires Drizzle against `feedback_thumbs`; tests inject the
 * `InMemoryFeedbackRepository` so the route handler stays exercisable
 * without a Postgres process. Mirrors `meetings-repository.ts`.
 *
 * The unique-key constraint `(user_id, meeting_id)` is enforced at the
 * DB layer; the in-memory shim mimics the same shape for parity.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { feedbackThumbs } from '@aisecretary/db/schema';
import { and, eq } from 'drizzle-orm';

export interface FeedbackThumbRow {
  id: string;
  tenantId: string;
  userId: string;
  meetingId: string;
  response: 'up' | 'down';
  context: string | null;
  createdAt: Date;
}

export interface RecordThumbsInput {
  tenantId: string;
  userId: string;
  meetingId: string;
  response: 'up' | 'down';
  context?: string | null;
}

/**
 * Thrown by the repository when the unique-(userId, meetingId)
 * constraint trips. The route layer translates to RFC 7807 / 409.
 */
export class FeedbackThumbsConflictError extends Error {
  constructor(message = 'Feedback already recorded for this meeting.') {
    super(message);
    this.name = 'FeedbackThumbsConflictError';
  }
}

export interface FeedbackRepository {
  /**
   * Inserts one row. Throws `FeedbackThumbsConflictError` when the
   * unique-(userId, meetingId) constraint trips.
   */
  recordThumbs(input: RecordThumbsInput): Promise<FeedbackThumbRow>;
}

const isUniqueViolation = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === '23505';
};

export class DrizzleFeedbackRepository implements FeedbackRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async recordThumbs(input: RecordThumbsInput): Promise<FeedbackThumbRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        try {
          const rows = await tx
            .insert(feedbackThumbs)
            .values({
              tenantId: input.tenantId,
              userId: input.userId,
              meetingId: input.meetingId,
              response: input.response,
              context: input.context ?? null,
            })
            .returning({
              id: feedbackThumbs.id,
              tenantId: feedbackThumbs.tenantId,
              userId: feedbackThumbs.userId,
              meetingId: feedbackThumbs.meetingId,
              response: feedbackThumbs.response,
              context: feedbackThumbs.context,
              createdAt: feedbackThumbs.createdAt,
            });
          const row = rows[0];
          if (!row) {
            throw new Error('recordThumbs: insert returned no rows');
          }
          return {
            id: row.id,
            tenantId: row.tenantId,
            userId: row.userId,
            meetingId: row.meetingId,
            response: row.response as 'up' | 'down',
            context: row.context ?? null,
            createdAt: row.createdAt,
          };
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new FeedbackThumbsConflictError();
          }
          throw err;
        }
      },
    );
  }
}

/**
 * In-memory repository for tests. Stores rows under a `(userId,
 * meetingId)` partition so duplicate inserts surface the same conflict
 * the real DB would.
 */
export class InMemoryFeedbackRepository implements FeedbackRepository {
  public readonly rows: FeedbackThumbRow[] = [];

  async recordThumbs(input: RecordThumbsInput): Promise<FeedbackThumbRow> {
    const conflict = this.rows.find(
      (r) => r.userId === input.userId && r.meetingId === input.meetingId,
    );
    if (conflict) {
      throw new FeedbackThumbsConflictError();
    }
    const row: FeedbackThumbRow = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      meetingId: input.meetingId,
      response: input.response,
      context: input.context ?? null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }
}

// Drizzle helpers re-exported for callers that want to compose queries.
export { and, eq };
