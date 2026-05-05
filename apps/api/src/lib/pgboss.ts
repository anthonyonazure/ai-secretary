/**
 * pg-boss factory + lifecycle helper for `apps/api`.
 *
 * Mirrors `apps/workers/src/lib/boss.ts` + `apps/bot/src/lib/boss.ts`.
 * The API process publishes to many queues (`transcribe`, `bot.join`,
 * `dsar.export`, `notification.send`) but consumes none — workers + bot
 * own consumption.
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

export const gracefulStopBoss = async (boss: PgBoss): Promise<void> => {
  await boss.stop({ graceful: true, timeout: 30_000 });
};
