/**
 * CRM integrations routes — Story 15.x / ADR-0003.
 *
 * Mount path: `/api/v1/crm` (set by `buildServer()` via prefix).
 *
 * Surfaces:
 *   - GET    /integrations                       list connected providers
 *   - POST   /integrations/:provider             connect (after OAuth callback)
 *   - DELETE /integrations/:integrationId        disconnect (sets status=revoked)
 *   - POST   /push                               enqueue a `crm.push` job
 *
 * The OAuth dance itself happens elsewhere — the user clicks Connect →
 * the SPA redirects to the provider authorize URL → the provider
 * redirects back with a code → the SPA hands the code to a separate
 * `/api/v1/auth/oauth/:provider/callback` style endpoint that exchanges
 * it for tokens and then POSTs to this route. By the time we land
 * here, the API server has the access_token + refresh_token in hand.
 *
 * The `whoAmI()` call against the provider on connect is what produces
 * the `accountLabel` we display + the `externalAccountId` we dedup on.
 */

import { randomUUID } from 'node:crypto';
import {
  type CrmAuditLogger,
  CrmAuthError,
  CrmGateway,
  type CrmRuntimeMode,
} from '@aisecretary/crm';
import {
  type CrmIntegrationListResponse,
  type CrmIntegrationResponse,
  type CrmPushResponse,
  crmConnectRequestSchema,
  crmIntegrationListResponseSchema,
  crmIntegrationResponseSchema,
  crmProviderSchema,
  crmPushRequestSchema,
  crmPushResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { CrmPushEnqueuer } from '../lib/crm-push-enqueue.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import type {
  CrmIntegrationRow,
  CrmIntegrationsRepository,
  PersistedCrmProvider,
} from './crm-repository.js';

export interface CrmRoutesOptions {
  repository: CrmIntegrationsRepository;
  enqueuer: CrmPushEnqueuer;
  /** Runtime mode — `'production'` in prod, `'test'` in tests, `'dev'` otherwise. */
  mode: CrmRuntimeMode;
}

const buildPerRequestAuditLogger = (request: FastifyRequest): CrmAuditLogger => ({
  async log(input) {
    await request.audit({
      action: input.action,
      resourceType: 'crm_integration',
      resourceId: input.resourceId,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  },
});

const requireUser = (request: FastifyRequest): { userId: string; tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { userId: request.user.userId, tenantId: request.tenantId };
};

const rowToResponse = (row: CrmIntegrationRow): CrmIntegrationResponse => ({
  id: row.id,
  provider: row.provider,
  externalAccountId: row.externalAccountId,
  accountLabel: row.accountLabel,
  instanceUrl: row.instanceUrl,
  apiBaseUrl: row.apiBaseUrl,
  scopes: row.scopes,
  status: row.status,
  failureReason: row.failureReason,
  connectedAt: row.connectedAt.toISOString(),
  lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
});

const integrationIdParamSchema = z.object({ integrationId: z.string().uuid() });
const providerParamSchema = z.object({ provider: crmProviderSchema });

export const crmRoutes = (options: CrmRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    /** GET /integrations — list connected integrations for the current tenant. */
    fastify.get('/integrations', { config: { skipAudit: true } }, async (request, reply) => {
      const { tenantId } = requireUser(request);
      const rows = await options.repository.list(tenantId);
      const body: CrmIntegrationListResponse = {
        items: rows.map(rowToResponse),
      };
      return reply.status(200).send(crmIntegrationListResponseSchema.parse(body));
    });

    /**
     * POST /integrations/:provider — finalize a connect after the
     * caller's OAuth callback has obtained the tokens.
     *
     * The route validates the tokens by calling `whoAmI()` through the
     * gateway — if the provider rejects, no row is persisted.
     */
    fastify.post<{ Params: { provider: string } }>(
      '/integrations/:provider',
      { config: { auditTags: ['crm.connected'] } },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);

        const paramParsed = providerParamSchema.safeParse(request.params);
        if (!paramParsed.success) {
          throw new ValidationError('Invalid provider in path.');
        }
        const provider = paramParsed.data.provider;

        const bodyParsed = crmConnectRequestSchema.safeParse(request.body);
        if (!bodyParsed.success) {
          throw new ValidationError(
            bodyParsed.error.issues[0]?.message ?? 'Invalid CRM connect payload',
            {
              extensions: {
                errors: bodyParsed.error.issues.map((i) => ({
                  path: i.path.join('.'),
                  message: i.message,
                  code: i.code,
                })),
              },
            },
          );
        }
        const body = bodyParsed.data;

        // Provider-specific param requirements.
        if (provider === 'salesforce' && !body.instanceUrl) {
          throw new ValidationError('salesforce requires instanceUrl');
        }
        if (provider === 'pipedrive' && !body.apiBaseUrl) {
          throw new ValidationError('pipedrive requires apiBaseUrl');
        }

        const gateway = new CrmGateway({
          mode: options.mode,
          auditLogger: buildPerRequestAuditLogger(request),
        });

        let account: Awaited<ReturnType<CrmGateway['whoAmI']>>;
        try {
          const factoryBody: FactoryConfigBody = {
            accessToken: body.accessToken,
            ...(body.instanceUrl ? { instanceUrl: body.instanceUrl } : {}),
            ...(body.apiBaseUrl ? { apiBaseUrl: body.apiBaseUrl } : {}),
          };
          account = await gateway.whoAmI({
            tenantId,
            actorUserId: userId,
            selector: { providerKind: provider, mode: options.mode },
            factory: buildFactoryConfig(provider, factoryBody, request.region),
          });
        } catch (err) {
          if (err instanceof CrmAuthError) {
            throw new UnauthorizedError('CRM credentials rejected by provider.');
          }
          throw err;
        }

        const row = await options.repository.create({
          tenantId,
          provider,
          externalAccountId: account.accountId,
          accountLabel: account.label,
          ...(body.instanceUrl ? { instanceUrl: body.instanceUrl } : {}),
          ...(body.apiBaseUrl ? { apiBaseUrl: body.apiBaseUrl } : {}),
          scopes: body.scopes ?? [],
          tokens: {
            accessToken: body.accessToken,
            ...(body.refreshToken ? { refreshToken: body.refreshToken } : {}),
          },
          ...(body.expiresAt ? { tokenExpiresAt: new Date(body.expiresAt) } : {}),
          connectedByUserId: userId,
        });

        return reply.status(201).send(crmIntegrationResponseSchema.parse(rowToResponse(row)));
      },
    );

    /** DELETE /integrations/:integrationId — soft-revoke an integration. */
    fastify.delete<{ Params: { integrationId: string } }>(
      '/integrations/:integrationId',
      { config: { auditTags: ['crm.disconnected'] } },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = integrationIdParamSchema.safeParse(request.params);
        if (!parsed.success) {
          throw new ValidationError('integrationId must be a valid UUID');
        }
        const row = await options.repository.revoke(parsed.data.integrationId, tenantId);
        if (!row) {
          throw new NotFoundError(`Integration ${parsed.data.integrationId} not found.`);
        }
        return reply.status(200).send(crmIntegrationResponseSchema.parse(rowToResponse(row)));
      },
    );

    /**
     * POST /push — enqueue a `crm.push` job. The route validates the
     * integration exists + is active, mints an idempotency key, then
     * hands off to the worker.
     */
    fastify.post('/push', { config: { skipAudit: true } }, async (request, reply) => {
      const { userId, tenantId } = requireUser(request);
      const parsed = crmPushRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid CRM push payload', {
          extensions: {
            errors: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
              code: i.code,
            })),
          },
        });
      }
      const body = parsed.data;

      const row = await options.repository.findById(body.integrationId, tenantId);
      if (!row) throw new NotFoundError(`Integration ${body.integrationId} not found.`);
      if (row.status !== 'active') {
        throw new ForbiddenError(`Integration ${row.id} is ${row.status}, not active.`);
      }

      // Idempotency key — meeting+integration+contact triple. Same
      // request from two clicks resolves to the same provider note.
      const idempotencyKey = `${body.meetingId}:${body.integrationId}:${body.contactEmail.toLowerCase()}`;

      const jobId = await options.enqueuer.enqueue({
        integrationId: row.id,
        tenantId,
        meetingId: body.meetingId,
        region: row.instanceUrl
          ? request.region // Salesforce keeps regional pin from the integration row
          : request.region,
        providerKind: row.provider,
        contactEmail: body.contactEmail.toLowerCase(),
        ...(body.contactFirstName ? { contactFirstName: body.contactFirstName } : {}),
        ...(body.contactLastName ? { contactLastName: body.contactLastName } : {}),
        ...(body.dealId ? { dealId: body.dealId } : {}),
        createContactIfMissing: body.createContactIfMissing,
        idempotencyKey,
        actorUserId: userId,
      });

      const responseBody: CrmPushResponse = {
        jobId: jobId ?? `inflight-${randomUUID()}`,
        idempotencyKey,
      };
      return reply.status(202).send(crmPushResponseSchema.parse(responseBody));
    });
  };
};

interface FactoryConfigBody {
  accessToken: string;
  instanceUrl?: string;
  apiBaseUrl?: string;
}

const buildFactoryConfig = (
  provider: PersistedCrmProvider,
  body: FactoryConfigBody,
  region: 'us' | 'eu',
): {
  hubspot?: { accessToken: string; region: 'us' | 'eu' };
  salesforce?: { accessToken: string; instanceUrl: string; region: 'us' | 'eu' };
  pipedrive?: { accessToken: string; apiBaseUrl: string; region: 'us' | 'eu' };
} => {
  switch (provider) {
    case 'hubspot':
      return { hubspot: { accessToken: body.accessToken, region } };
    case 'salesforce':
      if (!body.instanceUrl) throw new ValidationError('salesforce requires instanceUrl');
      return {
        salesforce: { accessToken: body.accessToken, instanceUrl: body.instanceUrl, region },
      };
    case 'pipedrive':
      if (!body.apiBaseUrl) throw new ValidationError('pipedrive requires apiBaseUrl');
      return {
        pipedrive: { accessToken: body.accessToken, apiBaseUrl: body.apiBaseUrl, region },
      };
  }
};
