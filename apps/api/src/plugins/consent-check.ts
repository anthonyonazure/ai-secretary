import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { ForbiddenError } from '../lib/http-error.js';

/**
 * `consent-check` plugin.
 *
 * Wraps `packages/consent`'s `consentCheck(tenantId, meetingId, db)` as a
 * Fastify route preHandler. Routes that mutate or read meeting recording
 * state opt in via `config.requireConsent: true` (or
 * `{ requireConsent: { meetingIdParam: 'id' } }` to override the param
 * name). Missing consent = 403.
 *
 * Per CLAUDE.md: "Recording without `consents` row = `consent-check`
 * plugin returns 403."
 *
 * ## Why an injected `consentChecker` instead of a direct DB call here
 *
 * The audit-logger plugin uses the same shape — sinks are pluggable so
 * tests pass an in-memory implementation and production wires the real
 * DB-backed one. Same rationale: `apps/api` doesn't have a Drizzle
 * connection wired into the plugin layer yet (Postgres pool wiring
 * lands when the auth + DB-bootstrap story ships). Until then this
 * plugin defaults to fail-closed (`'missing'` for any unconfigured
 * call) — the conservative choice for a consent gate. Production
 * server boot must inject a real `consentChecker` against the live
 * `consents` table.
 */
export type ConsentCheckerFn = (tenantId: string, meetingId: string) => Promise<'ok' | 'missing'>;

/**
 * Custom meeting-id resolver — Story 2.1 added this so recording routes
 * (which key on `recordingId` in the URL) can join through to the
 * recording's `meetingId` server-side without leaking the
 * recording-→-meeting linkage into the URL contract.
 *
 * Resolvers MUST be tenant-scoped: they're expected to read
 * `request.tenantId` and constrain the lookup to that tenant. The
 * consent gate downstream only takes `(tenantId, meetingId)`.
 */
export type MeetingIdResolverFn = (
  request: FastifyRequest,
) => Promise<string | null> | string | null;

export interface ConsentCheckPluginOptions {
  /**
   * Production: wraps `packages/consent`'s `consentCheck` with a real
   * Drizzle `Db` bound by `withTenantContext`. Tests / dev: stub.
   *
   * Default fail-closed implementation always returns `'missing'`. Choose
   * fail-closed because consent is a regulatory boundary — silent
   * permits would be a worse failure mode than spurious 403s during
   * staging.
   */
  consentChecker?: ConsentCheckerFn;
  /**
   * Map of resolver-name → async lookup. Routes opt in via
   * `config.requireConsent: { meetingIdResolver: '<name>' }`. Used by
   * the recordings routes (Story 2.1) to map a `recordingId` URL param
   * to the recording's `meetingId` for the consent check.
   *
   * If the resolver returns null, the gate is skipped (recording has
   * no associated meeting yet — common during the upload window).
   */
  resolvers?: Record<string, MeetingIdResolverFn>;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Per-route opt-in for the consent gate.
     *   - `true`                                → require consent; meetingId from
     *                                             `request.params.meetingId`.
     *   - `{ meetingIdParam: 'id' }`            → override the param name.
     *   - `{ meetingIdResolver: 'name' }`       → resolve the meetingId via a
     *                                             server-side lookup declared
     *                                             at plugin boot via
     *                                             `ConsentCheckPluginOptions.resolvers`.
     *                                             A null result skips the gate.
     */
    requireConsent?: true | { meetingIdParam: string } | { meetingIdResolver: string };
  }
}

const DEFAULT_PARAM = 'meetingId';

const failClosedChecker: ConsentCheckerFn = async () => 'missing';

const plugin: FastifyPluginAsync<ConsentCheckPluginOptions> = async (
  fastify: FastifyInstance,
  options: ConsentCheckPluginOptions,
) => {
  const checker = options.consentChecker ?? failClosedChecker;
  const resolvers = options.resolvers ?? {};

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const cfg = request.routeOptions.config?.requireConsent;
    if (!cfg) return;

    let meetingId: string | null;
    if (cfg === true || 'meetingIdParam' in cfg) {
      const paramName = cfg === true ? DEFAULT_PARAM : cfg.meetingIdParam;
      const params = request.params as Record<string, string | undefined>;
      meetingId = params[paramName] ?? null;
      if (!meetingId) {
        throw new ForbiddenError(`Consent gate requires '${paramName}' route param.`);
      }
    } else {
      const resolver = resolvers[cfg.meetingIdResolver];
      if (!resolver) {
        throw new ForbiddenError(
          `Consent gate resolver '${cfg.meetingIdResolver}' is not registered.`,
        );
      }
      meetingId = await resolver(request);
      // null result = skip the gate. Used for recordings not yet attached to a meeting.
      if (!meetingId) return;
    }

    const result = await checker(request.tenantId, meetingId);
    if (result === 'missing') {
      throw new ForbiddenError('Recording requires consent acknowledgment.');
    }
  });
};

export const consentCheckPlugin = fp(plugin, {
  name: 'consent-check',
  dependencies: ['tenant-context'],
});
