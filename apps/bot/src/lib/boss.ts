/**
 * pg-boss factory + lifecycle helper for `apps/bot`.
 *
 * Mirrors `apps/workers/src/lib/boss.ts`. The bot service is one PgBoss
 * instance per process — concurrency is intentionally low (1–2) since
 * each `bot.join` job runs for hours.
 */

import PgBoss from 'pg-boss';

export interface CreateBossOptions {
  databaseUrl: string;
  /** Pool size. Default 4. */
  max?: number;
  schema?: string;
}

export const createBoss = async (options: CreateBossOptions): Promise<PgBoss> => {
  const boss = new PgBoss({
    connectionString: options.databaseUrl,
    max: options.max ?? 4,
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
  });
  await boss.start();
  return boss;
};

export const gracefulStop = async (boss: PgBoss): Promise<void> => {
  // Each join job may be running for hours; a SIGTERM during a long-
  // running session should ABORT the in-flight job (the FSM transitions
  // to `failed`) rather than waiting indefinitely. The handler honors
  // its abortSignal, so a 30s graceful timeout is enough — pg-boss
  // signals the worker, the handler tears down provider/audio/heartbeat,
  // applies `failed`, and exits.
  await boss.stop({ graceful: true, timeout: 30_000 });
};
