/**
 * Story 1.7 — `InMemoryFeedbackRepository` unit tests.
 *
 * Locks the unique-(userId, meetingId) conflict semantics. The route
 * layer maps `FeedbackThumbsConflictError` → 409 RFC 7807; that mapping
 * relies on the repo throwing exactly this error class on duplicates.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { FeedbackThumbsConflictError, InMemoryFeedbackRepository } from './feedback-repository.js';

const tenantId = randomUUID();
const userId = randomUUID();
const meetingId = randomUUID();

describe('InMemoryFeedbackRepository.recordThumbs', () => {
  it('records a thumbs-up row with a generated id + timestamp', async () => {
    const repo = new InMemoryFeedbackRepository();
    const row = await repo.recordThumbs({
      tenantId,
      userId,
      meetingId,
      response: 'up',
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.response).toBe('up');
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('records a thumbs-down with optional context', async () => {
    const repo = new InMemoryFeedbackRepository();
    const row = await repo.recordThumbs({
      tenantId,
      userId,
      meetingId,
      response: 'down',
      context: 'Sales module missed the deal',
    });
    expect(row.response).toBe('down');
    expect(row.context).toBe('Sales module missed the deal');
  });

  it('defaults context to null when omitted', async () => {
    const repo = new InMemoryFeedbackRepository();
    const row = await repo.recordThumbs({ tenantId, userId, meetingId, response: 'up' });
    expect(row.context).toBeNull();
  });

  it('throws FeedbackThumbsConflictError on duplicate (user, meeting)', async () => {
    const repo = new InMemoryFeedbackRepository();
    await repo.recordThumbs({ tenantId, userId, meetingId, response: 'up' });
    await expect(
      repo.recordThumbs({ tenantId, userId, meetingId, response: 'down' }),
    ).rejects.toBeInstanceOf(FeedbackThumbsConflictError);
  });

  it('allows the same user to thumbs different meetings', async () => {
    const repo = new InMemoryFeedbackRepository();
    await repo.recordThumbs({ tenantId, userId, meetingId, response: 'up' });
    const second = await repo.recordThumbs({
      tenantId,
      userId,
      meetingId: randomUUID(),
      response: 'down',
    });
    expect(second.response).toBe('down');
    expect(repo.rows).toHaveLength(2);
  });

  it('allows different users to thumbs the same meeting', async () => {
    const repo = new InMemoryFeedbackRepository();
    await repo.recordThumbs({ tenantId, userId, meetingId, response: 'up' });
    const second = await repo.recordThumbs({
      tenantId,
      userId: randomUUID(),
      meetingId,
      response: 'down',
    });
    expect(second.response).toBe('down');
    expect(repo.rows).toHaveLength(2);
  });
});
