/**
 * Story 14.4 — `InMemoryErasurePreviewRepository` unit tests.
 *
 * Locks the action-mapping logic per-table + per-strategy:
 *   - `cascade-source` → cascade-source-skipped (handled by parent walk)
 *   - SHRED_TABLES (users / meetings / feedback_thumbs) → shred
 *   - REDACT_TABLES (action_items / notifications / audit_logs) → redact
 *   - CASCADE_FK_TABLES (module_outputs / speaker_turns / recordings /
 *     consents) → cascade-fk
 *   - everything else → noop-out-of-scope (zeroed in totals)
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { InMemoryErasurePreviewRepository } from './erasure-preview-repository.js';

const tenantId = randomUUID();
const userId = randomUUID();

describe('InMemoryErasurePreviewRepository.preview', () => {
  it('returns one stage per cascade entry with mapped actions', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    repo.counts.meetings = 12;
    repo.counts.audit_logs = 47;
    repo.counts.module_outputs = 8;
    const result = await repo.preview(
      [
        { table: 'meetings', strategy: 'shred' },
        { table: 'audit_logs', strategy: 'redact' },
        { table: 'module_outputs', strategy: 'cascade' },
      ],
      { tenantId, userId },
    );
    expect(result.stages).toHaveLength(3);
    expect(result.stages.map((s) => s.action)).toEqual(['shred', 'redact', 'cascade-fk']);
  });

  it('marks cascade-source strategy as skipped (handled by parent walk)', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    repo.counts.users = 1;
    const result = await repo.preview([{ table: 'users', strategy: 'cascade-source' }], {
      tenantId,
      userId,
    });
    expect(result.stages[0]?.action).toBe('cascade-source-skipped');
    expect(result.stages[0]?.rowCount).toBe(1);
  });

  it('zeros out noop-out-of-scope rowCount', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    repo.counts.unknown_table = 100;
    const result = await repo.preview([{ table: 'unknown_table', strategy: 'cascade' }], {
      tenantId,
      userId,
    });
    expect(result.stages[0]?.action).toBe('noop-out-of-scope');
    expect(result.stages[0]?.rowCount).toBe(0);
    expect(result.totalRowsAffected).toBe(0);
  });

  it('sums rowCounts only for in-scope actions', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    repo.counts.users = 1;
    repo.counts.meetings = 12;
    repo.counts.notifications = 47;
    const result = await repo.preview(
      [
        { table: 'users', strategy: 'shred' },
        { table: 'meetings', strategy: 'shred' },
        { table: 'notifications', strategy: 'redact' },
      ],
      { tenantId, userId },
    );
    expect(result.totalRowsAffected).toBe(60);
  });

  it('returns fullyHandled = true', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    const result = await repo.preview([], { tenantId, userId });
    expect(result.fullyHandled).toBe(true);
  });

  it('echoes the scope back through to the result', async () => {
    const repo = new InMemoryErasurePreviewRepository();
    const result = await repo.preview([], { tenantId, userId });
    expect(result.scope).toEqual({ tenantId, userId });
  });
});
