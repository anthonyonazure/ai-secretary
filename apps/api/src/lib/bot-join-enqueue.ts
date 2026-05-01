/**
 * Thin enqueue wrapper for the `bot.join` queue (pg-boss).
 *
 * Story 9.x — POST /api/v1/bot-sessions enqueues one job per bot
 * session creation. The handler lives in `apps/bot/src/handlers/
 * bot-join.ts`.
 *
 * The enqueue interface is pluggable so tests can capture the payload
 * without booting pg-boss. Production wiring registers a real PgBoss-
 * backed enqueuer at boot.
 */

import type { Region } from '@aisecretary/db';

export interface BotJoinJobPayload {
  sessionId: string;
  tenantId: string;
  region: Region;
}

export interface BotJoinEnqueuer {
  /** Returns a queue-side job id (or null when the queue lacks one). */
  enqueue(payload: BotJoinJobPayload): Promise<string | null>;
}

/** Default in-memory enqueuer — used by tests and dev when no queue is wired. */
export class InMemoryBotJoinEnqueuer implements BotJoinEnqueuer {
  public readonly jobs: Array<{ id: string; payload: BotJoinJobPayload }> = [];
  private counter = 0;

  async enqueue(payload: BotJoinJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `bot-join-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}
