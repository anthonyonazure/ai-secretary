/**
 * Postgres pool factory for the api process.
 *
 * Wraps `@aisecretary/db`'s `createDb` so callers don't need to import
 * the package directly. Exposed via the `db` Fastify plugin as
 * `fastify.db` + `fastify.dbClient`.
 */

import { type Db, type Region, createDb } from '@aisecretary/db';
import type postgres from 'postgres';

export interface DbHandle {
  db: Db;
  client: postgres.Sql;
  region: Region;
  close: () => Promise<void>;
}

export interface CreateDbHandleOptions {
  databaseUrl: string;
  region: Region;
  poolSize?: number;
}

export const createDbHandle = (options: CreateDbHandleOptions): DbHandle => {
  const { db, client, region } = createDb({
    databaseUrl: options.databaseUrl,
    region: options.region,
    ...(options.poolSize !== undefined ? { poolSize: options.poolSize } : {}),
  });
  return {
    db,
    client,
    region,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
};
