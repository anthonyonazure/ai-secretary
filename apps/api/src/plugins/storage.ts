/**
 * `storage` plugin — decorates `fastify.storage` with a
 * `StorageProvider` from `@aisecretary/storage`.
 *
 * Production: wired at boot from env (S3 bucket + region) via
 * `createStorageProvider`. Tests inject their own mock provider via
 * `buildServer({ storageProvider })`.
 *
 * No teardown hook — S3 clients are stateless; the SDK's own connection
 * pool is process-scoped and cleaned up by the AWS SDK on exit.
 */

import type { StorageProvider } from '@aisecretary/storage';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageProvider;
  }
}

export interface StoragePluginOptions {
  provider: StorageProvider;
}

const plugin: FastifyPluginAsync<StoragePluginOptions> = async (
  fastify: FastifyInstance,
  options: StoragePluginOptions,
) => {
  fastify.decorate('storage', options.provider);
};

export const storagePlugin = fp(plugin, {
  name: 'storage',
});
