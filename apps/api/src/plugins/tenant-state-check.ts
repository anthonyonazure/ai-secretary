/**
 * `tenant-state-check` plugin — Story 12.1 / ADR-0004.
 *
 * Gates mutating recording-pipeline routes when the tenant's lifecycle
 * state is not in `{active, provisioning}`. Honors the trial-fields
 * extension: a tenant whose `trial_expired_at` is non-null gets 402
 * Payment Required on mutating routes (read + DSAR + admin retained).
 *
 * Routes opt in via `config.requireTenantState: true` (default OFF —
 * only routes that mutate the recording pipeline gate themselves).
 * Most read-only + admin routes don't need this gate.
 *
 * Discipline:
 *   - The plugin is registered AFTER `tenant-context` so `request.tenantId`
 *     is populated.
 *   - The reader is injected so tests don't need a DB process.
 *   - The check is read-only — it never mutates the tenant row.
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError, HttpError } from '../lib/http-error.js';

export type TenantStateValue =
  | 'draft'
  | 'dpa_required'
  | 'dpa_accepted'
  | 'region_pinning'
  | 'provisioning'
  | 'active'
  | 'suspended';

export interface TenantStateSnapshot {
  state: TenantStateValue;
  /** ISO timestamp when the trial expired without conversion; null otherwise. */
  trialExpiredAt: string | null;
}

export interface TenantStateReader {
  findByTenantId(tenantId: string): Promise<TenantStateSnapshot | null>;
}

export interface TenantStateCheckPluginOptions {
  reader: TenantStateReader;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Story 12.1 — gate this route on the tenant lifecycle FSM.
     * When `true`, the request must be from a tenant in
     * `{active, provisioning}` AND must NOT have an expired trial.
     */
    requireTenantState?: boolean;
  }
}

class TrialExpiredError extends HttpError {
  constructor() {
    super(402, 'Trial Expired', 'Your trial has ended. Upgrade to keep recording meetings.');
    this.name = 'TrialExpiredError';
  }
}

const ALLOWED_STATES: ReadonlySet<TenantStateValue> = new Set(['active', 'provisioning']);

const buildPlugin: FastifyPluginAsync<TenantStateCheckPluginOptions> = async (fastify, options) => {
  // Cache snapshots within a request — multiple gates on the same
  // request shouldn't re-fetch.
  const requestCache = new WeakMap<FastifyRequest, Promise<TenantStateSnapshot | null>>();

  const getSnapshot = async (request: FastifyRequest): Promise<TenantStateSnapshot | null> => {
    const cached = requestCache.get(request);
    if (cached) return await cached;
    const promise = options.reader.findByTenantId(request.tenantId);
    requestCache.set(request, promise);
    return await promise;
  };

  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const config = request.routeOptions.config as
      | { requireTenantState?: boolean; skipTenantContext?: boolean }
      | undefined;
    if (!config?.requireTenantState) return;
    if (config.skipTenantContext) return; // public route — no tenant
    if (!request.tenantId) {
      throw new ForbiddenError('Tenant context missing.');
    }

    const snapshot = await getSnapshot(request);
    if (!snapshot) {
      // No row yet — treat as draft → block mutating routes.
      throw new ForbiddenError('Tenant onboarding not complete (no state row).');
    }
    if (snapshot.trialExpiredAt) {
      throw new TrialExpiredError();
    }
    if (!ALLOWED_STATES.has(snapshot.state)) {
      throw new ForbiddenError(
        `Tenant state '${snapshot.state}' does not permit this action. Complete onboarding first.`,
      );
    }
  });
};

export const tenantStateCheckPlugin = fp(buildPlugin, {
  name: 'tenant-state-check',
  dependencies: ['tenant-context'],
});

/** In-memory reader for tests + non-DB demo deploys. */
export class InMemoryTenantStateReader implements TenantStateReader {
  public readonly snapshots = new Map<string, TenantStateSnapshot>();

  async findByTenantId(tenantId: string): Promise<TenantStateSnapshot | null> {
    return this.snapshots.get(tenantId) ?? null;
  }
}
