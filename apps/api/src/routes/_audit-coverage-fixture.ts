import type { FastifyPluginAsync } from 'fastify';

/**
 * Audit-coverage fixture routes.
 *
 * These are real (mounted) routes that exercise both audit-emit paths:
 *   - tag-driven auto-emit via `config.auditTags`
 *   - manual emit via `request.audit({...})`
 *
 * The `check-audit-coverage` CI script (apps/api/scripts/check-audit-
 * coverage.ts) walks `routes/**` and asserts that every non-GET route
 * uses one of these two mechanisms. Removing one of these handlers
 * without keeping the other path covered will fail the CI gate.
 */
export const auditCoverageFixtureRoutes: FastifyPluginAsync = async (fastify) => {
  // Path 1: tag-driven auto-emit.
  fastify.post(
    '/_fixtures/audit-tagged',
    {
      config: {
        auditTags: ['meeting.created'],
      },
    },
    async () => ({ ok: true, mode: 'auto-tagged' }),
  );

  // Path 2: manual emit inside the handler.
  fastify.post('/_fixtures/audit-manual', async (request) => {
    await request.audit({
      action: 'meeting.updated',
      resourceType: 'meeting',
      resourceId: 'fixture',
      metadata: { mode: 'manual' },
    });
    return { ok: true, mode: 'manual' };
  });
};
