import { loadEnv } from './env.js';
import { buildProductionServer } from './server.js';

/**
 * Production entry point.
 *
 * Boots the Fastify server, listens on `PORT`, and handles SIGTERM /
 * SIGINT for graceful shutdown. Tests bypass this and call `buildServer`
 * directly.
 *
 * `buildProductionServer()` wires the live DB handle, which decorates
 * `fastify.db` and switches the audit sink + consent checker to their
 * Postgres-backed implementations (see resolveAuditSink +
 * resolveConsentChecker in server.ts).
 */
const main = async (): Promise<void> => {
  const env = loadEnv();
  const handle = await buildProductionServer();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    handle.fastify.log.info({ signal }, 'shutdown-initiated');
    try {
      await handle.close();
      process.exit(0);
    } catch (err) {
      handle.fastify.log.error({ err }, 'shutdown-failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  try {
    await handle.fastify.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    handle.fastify.log.error({ err }, 'listen-failed');
    process.exit(1);
  }
};

// Only run main() when invoked as a script — keep the module import-safe.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}

export { buildServer, buildProductionServer } from './server.js';
export { loadEnv } from './env.js';
export const APP_NAME = '@aisecretary/api';
