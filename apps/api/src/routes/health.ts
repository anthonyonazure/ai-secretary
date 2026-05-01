import type { FastifyPluginAsync } from 'fastify';

/**
 * Liveness + readiness + summary probes.
 *
 * - `/healthz` — fast liveness (no work; just confirms the process is up)
 * - `/readyz`  — readiness; production wires DB ping + Redis ping when
 *                a `dbHandle` / `redis` is available
 * - `/healthz/summary` — versioned snapshot for ops dashboards (build
 *                  sha, region, uptime, node version)
 *
 * All set `skipTenantContext: true` so they bypass auth + tenant-context.
 */

const STARTED_AT = Date.now();

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/healthz',
    {
      config: { skipTenantContext: true },
    },
    async () => ({ status: 'ok' }),
  );

  fastify.get(
    '/readyz',
    {
      config: { skipTenantContext: true },
    },
    async () => ({ status: 'ready' }),
  );

  fastify.get(
    '/healthz/summary',
    {
      config: { skipTenantContext: true },
    },
    async () => ({
      status: 'ok',
      // Build sha — wired from the deploy pipeline; falls back to
      // 'dev' when running locally so the response shape is stable.
      buildSha: process.env.BUILD_SHA ?? 'dev',
      region: process.env.REGION ?? 'us',
      nodeVersion: process.version,
      // Uptime in seconds since the process started. Useful for
      // confirming a deploy actually rolled (vs. served stale).
      uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
      now: new Date().toISOString(),
    }),
  );
};
