import type { Region } from '@aisecretary/db';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Env } from '../env.js';
import { UnauthorizedError } from '../lib/http-error.js';

const TENANT_HEADER = 'x-tenant-id';
const USER_HEADER = 'x-user-id';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isRegion = (value: unknown): value is Region => value === 'us' || value === 'eu';

export interface TenantContextPluginOptions {
  env: Pick<Env, 'NODE_ENV' | 'REGION'>;
}

/**
 * Resolves `request.tenantId` + `request.region` for every request.
 *
 * Resolution order:
 *   1. `request.user?.tenantId` — verified-claim from the `jwt` plugin
 *      (Story 1.5a). Primary source of truth in production.
 *   2. `x-tenant-id` header — accepted only when `NODE_ENV !== 'production'`.
 *      Dev/test escape hatch for routes that haven't been wired through
 *      the auth flow yet (or for direct E2E injection).
 *
 * Region comes from `process.env.REGION` (set per deployment). It's
 * validated against the `('us' | 'eu')` enum — anything else fails-closed
 * at boot via the env loader.
 *
 * Routes that should bypass this plugin (health checks + pre-auth
 * `/auth/*` routes) set `config.skipTenantContext = true` on
 * registration.
 */
const plugin: FastifyPluginAsync<TenantContextPluginOptions> = async (
  fastify: FastifyInstance,
  options: TenantContextPluginOptions,
) => {
  const { env } = options;

  if (!isRegion(env.REGION)) {
    throw new Error(`tenant-context: invalid REGION ${String(env.REGION)} (must be 'us' | 'eu')`);
  }

  fastify.decorateRequest('tenantId', '');
  fastify.decorateRequest('region', 'us');
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const skip = request.routeOptions.config?.skipTenantContext === true;
    if (skip) {
      // Health checks — leave decorators at defaults.
      return;
    }

    const region = env.REGION;
    request.region = region;

    // 1. Verified JWT claim path — populated by the `jwt` plugin.
    if (request.user && isUuid(request.user.tenantId)) {
      request.tenantId = request.user.tenantId;
      return;
    }

    // 2. Dev/test header path (non-production only).
    if (env.NODE_ENV !== 'production') {
      const headerValue = request.headers[TENANT_HEADER];
      const tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (typeof tenantId === 'string' && isUuid(tenantId)) {
        request.tenantId = tenantId;
        // Populate a synthetic `user` for logs when an opt-in `x-user-id`
        // is provided — purely a dev affordance.
        const userIdHeader = request.headers[USER_HEADER];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
        if (typeof userId === 'string' && isUuid(userId)) {
          request.user = { tenantId, userId, region, role: 'org_admin' };
        }
        return;
      }
    }

    // Fail closed. Auth-less requests in production never see tenant data.
    throw new UnauthorizedError('Missing tenant context. Authenticate first.');
  });
};

export const tenantContextPlugin = fp(plugin, {
  name: 'tenant-context',
  dependencies: ['request-id'],
});
