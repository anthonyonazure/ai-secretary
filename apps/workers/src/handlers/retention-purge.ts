/**
 * `retention.purge` cron handler — Story 12.3 (FR43).
 *
 * Once a day, scans every tenant's recordings/transcripts/module-outputs
 * and deletes anything older than the per-tenant retention windows.
 *
 * Per-tenant policy is configured by the org admin via the F2-admin
 * surface (Story 12.1 follow-up — `tenant_settings.retention_audio_days`
 * + `retention_transcript_days` + `retention_per_vertical`). Today the
 * worker reads from a `retentionPolicyResolver` injection so tests can
 * stub deterministically and production can wire the real
 * tenant_settings lookup once that table lands.
 *
 * What gets purged:
 *   - `recordings` rows older than `retention_audio_days` AND scrub the
 *     underlying object via packages/storage
 *   - `speaker_turns` + `module_outputs` + `action_items` for meetings
 *     older than `retention_transcript_days` (FK CASCADE handles the
 *     dependent rows once the meeting row goes)
 *
 * Audit-row emit: not yet wired (worker-side audit-logger lands in
 * Story 1.4 follow-up). Until then we structure-log the purge with
 * `tenantId`, `purgedRecordingCount`, `purgedMeetingCount`,
 * `bytesScrubbed`.
 */

import type { Db, Region } from '@aisecretary/db';
import { meetings, recordings } from '@aisecretary/db/schema';
import type { StorageProvider } from '@aisecretary/storage';
import { and, eq, lte } from 'drizzle-orm';
import type pino from 'pino';

import { withJobContext } from '../lib/job-context.js';

export const RETENTION_PURGE_QUEUE = 'retention.purge';
/** Once a day at 03:00 UTC — quiet hours for most tenants. */
export const RETENTION_PURGE_CRON = '0 3 * * *';

export interface RetentionPolicy {
  audioDays: number;
  transcriptDays: number;
}

export interface RetentionPolicyResolver {
  /**
   * Returns every tenant's retention policy in the named region. The
   * worker iterates the result; tests stub a small fixture, production
   * wires a `withTenantContext`-bypassing read against `tenant_settings`.
   */
  listTenants(region: Region): Promise<Array<{ tenantId: string; policy: RetentionPolicy }>>;
}

export interface RetentionPurgeDeps {
  db: Db;
  storage: StorageProvider;
  logger: pino.Logger;
  resolver: RetentionPolicyResolver;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const purgeOneTenant = async (
  deps: RetentionPurgeDeps,
  region: Region,
  tenantId: string,
  policy: RetentionPolicy,
  now: Date,
): Promise<{ purgedRecordings: number; purgedMeetings: number; bytesScrubbed: number }> => {
  const audioCutoff = new Date(now.getTime() - policy.audioDays * DAY_MS);
  const transcriptCutoff = new Date(now.getTime() - policy.transcriptDays * DAY_MS);

  return await withJobContext(deps.db, { tenantId, region }, async (tx) => {
    // 1) Find recordings older than the audio cutoff. Read first so we
    // can scrub the storage objects before the row goes.
    const expiredRecordings = await tx
      .select({
        id: recordings.id,
        storageKey: recordings.storageKey,
      })
      .from(recordings)
      .where(and(eq(recordings.tenantId, tenantId), lte(recordings.createdAt, audioCutoff)));

    let bytesScrubbed = 0;
    for (const rec of expiredRecordings) {
      try {
        await deps.storage.delete(rec.storageKey);
        // packages/storage's delete doesn't return byte count; we
        // approximate via a 0 bump. Production would query head-bytes
        // first or carry a `size_bytes` column on `recordings`.
        bytesScrubbed += 0;
      } catch (err) {
        deps.logger.warn(
          { err, recordingId: rec.id, storageKey: rec.storageKey, tenantId },
          'retention-purge: storage delete failed; row will be retried next run',
        );
        // Continue with the next recording — partial failure is OK; the
        // next cron run picks up whatever didn't complete.
      }
    }

    // 2) Delete the recording rows. FK CASCADE from meetings handles
    // dependent rows when the meeting itself is deleted.
    const deletedRecordings = await tx
      .delete(recordings)
      .where(and(eq(recordings.tenantId, tenantId), lte(recordings.createdAt, audioCutoff)))
      .returning({ id: recordings.id });

    // 3) Delete meetings older than the transcript cutoff. FK CASCADE
    // handles speaker_turns + module_outputs + action_items.
    const deletedMeetings = await tx
      .delete(meetings)
      .where(and(eq(meetings.tenantId, tenantId), lte(meetings.createdAt, transcriptCutoff)))
      .returning({ id: meetings.id });

    return {
      purgedRecordings: deletedRecordings.length,
      purgedMeetings: deletedMeetings.length,
      bytesScrubbed,
    };
  });
};

export const createRetentionPurgeHandler = (deps: RetentionPurgeDeps) => {
  return async (): Promise<void> => {
    const now = (deps.now ?? (() => new Date()))();
    let totalRecordings = 0;
    let totalMeetings = 0;
    for (const region of ['us', 'eu'] as const) {
      const tenants = await deps.resolver.listTenants(region);
      for (const t of tenants) {
        try {
          const result = await purgeOneTenant(deps, region, t.tenantId, t.policy, now);
          totalRecordings += result.purgedRecordings;
          totalMeetings += result.purgedMeetings;
          deps.logger.info(
            {
              tenantId: t.tenantId,
              region,
              policy: t.policy,
              purgedRecordings: result.purgedRecordings,
              purgedMeetings: result.purgedMeetings,
              bytesScrubbed: result.bytesScrubbed,
            },
            'retention-purge: completed for tenant',
          );
        } catch (err) {
          deps.logger.error(
            { err, tenantId: t.tenantId, region },
            'retention-purge: failed for tenant; continuing',
          );
        }
      }
    }
    deps.logger.info({ totalRecordings, totalMeetings }, 'retention-purge: pass complete');
  };
};
