/**
 * pg-boss factory + lifecycle helper.
 *
 * Workers boot one PgBoss instance per process. Story 2.1 only registers
 * the `transcribe` queue; later stories register `summarize`, `analyze`,
 * `index`, and `retention` (per architecture.md § Async work).
 *
 * `createBoss(databaseUrl)` returns a started PgBoss instance.
 * `gracefulStop(boss)` closes the queue cleanly on SIGTERM/SIGINT.
 */

import PgBoss from 'pg-boss';

export interface CreateBossOptions {
  databaseUrl: string;
  /** Pool size; default 4 for workers (per architecture.md). */
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
  // pg-boss stop() awaits any in-flight job to complete, then closes the pool.
  await boss.stop({ graceful: true, timeout: 30_000 });
};
