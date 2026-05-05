/**
 * Thin enqueue wrapper for the `transcribe` queue (pg-boss).
 *
 * Story 2.1 ships the call site (POST /recordings/:id/complete enqueues
 * one job per upload). The actual handler is in `apps/workers` — see
 * `apps/workers/src/handlers/transcribe.ts`. The handler stub doesn't
 * call any transcription engine yet — Story 2.2 / 2.5 wire
 * `packages/transcription` in.
 *
 * The enqueue interface is pluggable so tests can capture the payload
 * without booting pg-boss. Production wiring registers a real PgBoss-
 * backed enqueuer at boot.
 */

import type { Region } from '@aisecretary/db';

export interface TranscribeJobPayload {
  recordingId: string;
  tenantId: string;
  region: Region;
}

export interface TranscribeEnqueuer {
  /** Returns a queue-side job id (or null when the queue lacks one). */
  enqueue(payload: TranscribeJobPayload): Promise<string | null>;
}

/** Default in-memory enqueuer — used by tests and dev when no queue is wired. */
export class InMemoryTranscribeEnqueuer implements TranscribeEnqueuer {
  public readonly jobs: Array<{ id: string; payload: TranscribeJobPayload }> = [];
  private counter = 0;

  async enqueue(payload: TranscribeJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `mem-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}

export const TRANSCRIBE_QUEUE = 'transcribe' as const;

/**
 * pg-boss-backed enqueuer — production wires this in
 * `buildProductionServer()`. Mirrors `apps/bot`'s `PgBossTranscribeEnqueuer`.
 */
export class PgBossTranscribeEnqueuer implements TranscribeEnqueuer {
  // biome-ignore lint/suspicious/noExplicitAny: pg-boss is the only consumer of this seam in production.
  constructor(private readonly boss: { send(name: string, data: unknown): Promise<any> }) {}

  async enqueue(payload: TranscribeJobPayload): Promise<string | null> {
    const id = await this.boss.send(TRANSCRIBE_QUEUE, payload);
    return id ?? null;
  }
}
