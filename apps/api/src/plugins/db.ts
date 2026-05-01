/**
 * `db` plugin — decorates `fastify.db` with a Drizzle handle and closes
 * the underlying postgres pool on app shutdown.
 *
 * Tests typically inject their own handle via `buildServer({ dbHandle })`
 * (an `InMemoryAuditSink` is also injected to skip persistence). This
 * plugin only registers when a handle is passed in, so unit tests with
 * no DB never touch postgres.
 */

import type { Db } from '@aisecretary/db';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { DbHandle } from '../lib/db.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dbHandle: DbHandle;
  }
}

export interface DbPluginOptions {
  handle: DbHandle;
}

const plugin: FastifyPluginAsync<DbPluginOptions> = async (
  fastify: FastifyInstance,
  options: DbPluginOptions,
) => {
  fastify.decorate('db', options.handle.db);
  fastify.decorate('dbHandle', options.handle);

  fastify.addHook('onClose', async () => {
    await options.handle.close();
  });
};

export const dbPlugin = fp(plugin, {
  name: 'db',
});
