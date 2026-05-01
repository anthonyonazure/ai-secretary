/**
 * `jwt` plugin — verify-only.
 *
 * Reads `Authorization: Bearer <token>` on every incoming request, calls
 * `verifyAccessToken` from `@aisecretary/auth/jwt`, and populates
 * `request.user` with the verified-claim slice. Does NOT 401 on its
 * own — auth-required routes throw `UnauthorizedError` themselves.
 *
 * Token issuance happens in the `/auth/*` route handlers, not here.
 *
 * Plugin order: this plugin registers BEFORE `tenant-context` so the
 * latter can read `request.user?.tenantId` as the primary source of
 * truth (with `x-tenant-id` as a non-prod fallback).
 */

import { verifyAccessToken } from '@aisecretary/auth';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

export interface JwtPluginOptions {
  /** HS256 secret. Must be ≥32 chars (env loader enforces this). */
  secret: string;
}

const BEARER_PREFIX = 'Bearer ';

const extractToken = (header: string | string[] | undefined): string | null => {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || !value.startsWith(BEARER_PREFIX)) return null;
  const token = value.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

const plugin: FastifyPluginAsync<JwtPluginOptions> = async (
  fastify: FastifyInstance,
  options: JwtPluginOptions,
) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const token = extractToken(request.headers.authorization);
    if (!token) {
      // Leave the existing default (`null`) on `request.user`.
      return;
    }
    try {
      const payload = await verifyAccessToken(token, options.secret);
      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        region: payload.region,
        role: payload.role,
      };
    } catch (err) {
      // Invalid / expired / tampered token → leave `request.user = null`.
      // Routes that require auth throw `UnauthorizedError` when they
      // see `request.user === null`.
      request.log.debug({ err }, 'jwt: token verification failed');
    }
  });
};

export const jwtPlugin = fp(plugin, {
  name: 'jwt',
  dependencies: ['request-id'],
});
