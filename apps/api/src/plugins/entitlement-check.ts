/**
 * `entitlement-check` plugin — Story 13.2 / FR38.
 *
 * Per-route gate that reads `tenant_entitlements` and rejects requests
 * whose tier doesn't permit the action. Two opt-in modes:
 *
 *   1. Boolean feature flags via `config.requireFeature: 'bot'`
 *      Rejects with 403 + RFC 7807 + `extensions.upsell` hint when
 *      the feature is disabled for the caller's tenant.
 *
 *   2. Module entitlement check via `config.requireModule: 'sales'`
 *      Used by the analysis pipeline routes; Pro+ tiers carry every
 *      module, Free carries only `general`.
 *
 * Discipline:
 *   - The plugin is registered AFTER `tenant-context` so `request.tenantId`
 *     is populated.
 *   - The repository is injected so tests don't need a DB process.
 *   - The check is read-only — it never mutates the entitlement row.
 *
 * Upsell hint (consumed by the locked-module upsell pattern, Story 13.6):
 *   The 403 response carries `extensions.upsell` with the minimum tier
 *   that unlocks the feature. The frontend renders the
 *   `LockedModuleUpsell` component using this hint.
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ForbiddenError } from '../lib/http-error.js';

export type EntitlementFeatureFlag = 'bot' | 'sso' | 'audit-export' | 'cross-org-sharing';

export interface EntitlementSnapshot {
  tierId: string;
  enabledModuleIds: string[];
  botEnabled: boolean;
  ssoEnabled: boolean;
  auditExportEnabled: boolean;
  crossOrgSharingEnabled: boolean;
}

export interface EntitlementRepository {
  findByTenantId(tenantId: string): Promise<EntitlementSnapshot | null>;
}

export interface EntitlementCheckPluginOptions {
  repository: EntitlementRepository;
  /**
   * Default snapshot when no row exists for a tenant. Production
   * shouldn't hit this (the F2-admin flow seeds the row at signup);
   * when it does, fail closed to the Free-tier shape.
   */
  defaultSnapshot?: EntitlementSnapshot;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Story 13.2 — gate this route on a boolean feature flag. Examples:
     *   `requireFeature: 'bot'`, `requireFeature: 'cross-org-sharing'`.
     */
    requireFeature?: EntitlementFeatureFlag;
    /**
     * Story 13.2 — gate this route on a module entitlement. The route
     * caller passes the module id at config time; the plugin checks the
     * tenant's `enabled_module_ids` set.
     */
    requireModule?: string;
  }
}

const FEATURE_FLAG_LABEL: Record<EntitlementFeatureFlag, string> = {
  bot: 'meeting bot',
  sso: 'SSO',
  'audit-export': 'audit-log export',
  'cross-org-sharing': 'cross-org sharing',
};

const FEATURE_FLAG_MIN_TIER: Record<EntitlementFeatureFlag, string> = {
  bot: 'pro',
  sso: 'business',
  'audit-export': 'business',
  'cross-org-sharing': 'pro',
};

const FEATURE_GETTER: Record<EntitlementFeatureFlag, (s: EntitlementSnapshot) => boolean> = {
  bot: (s) => s.botEnabled,
  sso: (s) => s.ssoEnabled,
  'audit-export': (s) => s.auditExportEnabled,
  'cross-org-sharing': (s) => s.crossOrgSharingEnabled,
};

export const DEFAULT_FREE_SNAPSHOT: EntitlementSnapshot = {
  tierId: 'free',
  enabledModuleIds: ['general'],
  botEnabled: false,
  ssoEnabled: false,
  auditExportEnabled: false,
  crossOrgSharingEnabled: false,
};

const plugin: FastifyPluginAsync<EntitlementCheckPluginOptions> = async (fastify, options) => {
  const fallback = options.defaultSnapshot ?? DEFAULT_FREE_SNAPSHOT;

  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const config = request.routeOptions.config;
    if (!config) return;
    const requiredFeature = config.requireFeature;
    const requiredModule = config.requireModule;
    if (!requiredFeature && !requiredModule) return;

    if (!request.tenantId) {
      // No tenant context — auth-gated routes will already have rejected
      // upstream. Belt-and-braces: deny.
      throw new ForbiddenError('Tenant context missing.');
    }

    const snapshot = (await options.repository.findByTenantId(request.tenantId)) ?? fallback;

    if (requiredFeature) {
      const allowed = FEATURE_GETTER[requiredFeature](snapshot);
      if (!allowed) {
        throw new ForbiddenError(
          `Your plan doesn't include ${FEATURE_FLAG_LABEL[requiredFeature]}.`,
          {
            extensions: {
              code: 'entitlement-required',
              feature: requiredFeature,
              currentTier: snapshot.tierId,
              upsell: {
                minimumTier: FEATURE_FLAG_MIN_TIER[requiredFeature],
                feature: requiredFeature,
                label: FEATURE_FLAG_LABEL[requiredFeature],
              },
            },
          },
        );
      }
    }

    if (requiredModule) {
      const enabled = snapshot.enabledModuleIds.includes(requiredModule);
      if (!enabled) {
        throw new ForbiddenError(`The "${requiredModule}" module isn't enabled for your plan.`, {
          extensions: {
            code: 'module-required',
            module: requiredModule,
            currentTier: snapshot.tierId,
            upsell: {
              minimumTier: requiredModule === 'medical' ? 'business' : 'pro',
              module: requiredModule,
            },
          },
        });
      }
    }
  });
};

export const entitlementCheckPlugin = fp(plugin, {
  name: 'entitlement-check',
  dependencies: ['tenant-context'],
});

/** In-memory repository — tests + dev. */
export class InMemoryEntitlementRepository implements EntitlementRepository {
  public readonly rows = new Map<string, EntitlementSnapshot>();

  set(tenantId: string, snapshot: EntitlementSnapshot): void {
    this.rows.set(tenantId, snapshot);
  }

  async findByTenantId(tenantId: string): Promise<EntitlementSnapshot | null> {
    return this.rows.get(tenantId) ?? null;
  }
}
