/**
 * Production `RecordingWatchdogReader` — reads in-flight recordings
 * across tenants for the Story 4.4 watchdog.
 *
 * RLS bypass note: this is a system-level scan, so we bypass tenant
 * isolation by NOT going through `withTenantContext`. The query joins
 * `recordings` against `tenants` to attach the region; the resulting
 * rows are then handed to the watchdog which itself enqueues
 * notification jobs that DO carry tenant context.
 *
 * The DB role for the workers process must allow cross-tenant SELECT
 * on `recordings`. RLS policy `0005_rls_recordings.sql` permits this
 * when `app.current_tenant_id` is unset (system-job mode); tenant-
 * scoped queries set the GUC and get filtered.
 */

import type { Db } from '@aisecretary/db';
import { recordings, tenants } from '@aisecretary/db/schema';
import { and, eq, gte, inArray } from 'drizzle-orm';
import type { InFlightRecording, RecordingWatchdogReader } from './recording-watchdog.js';

export class DrizzleRecordingWatchdogReader implements RecordingWatchdogReader {
  constructor(private readonly db: Db) {}

  async listInFlight({ sinceMs }: { sinceMs: number }): Promise<InFlightRecording[]> {
    const since = new Date(sinceMs);
    // No `withTenantContext` — this is a system-level scan. The join
    // hands us `region` so the notification job carries it through to
    // the regional dispatcher.
    const rows = await this.db
      .select({
        recordingId: recordings.id,
        tenantId: recordings.tenantId,
        ownerUserId: recordings.ownerUserId,
        meetingId: recordings.meetingId,
        region: tenants.region,
      })
      .from(recordings)
      .innerJoin(tenants, eq(recordings.tenantId, tenants.id))
      .where(
        and(
          inArray(recordings.status, ['uploading', 'uploaded', 'transcribing']),
          gte(recordings.startedAt, since),
        ),
      );

    return rows.map((r) => ({
      tenantId: r.tenantId,
      recordingId: r.recordingId,
      ownerUserId: r.ownerUserId,
      meetingId: r.meetingId,
      region: r.region as 'us' | 'eu',
    }));
  }
}
