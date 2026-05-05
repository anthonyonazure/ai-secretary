/**
 * `crm.push` queue handler — Story 15.x / ADR-0003.
 *
 * Resolves the meeting summary + action items from the DB, decrypts
 * the integration's OAuth tokens via the KEK keyring, then pushes the
 * note through `@aisecretary/crm`. Retry budget is 5 minutes wall-
 * clock; transient errors (rate-limit, 5xx) re-throw so pg-boss retries
 * with backoff. Auth errors mark the integration `status='error'` and
 * stop retrying.
 */

import {
  CrmAuthError,
  CrmGateway,
  type CrmGatewayDeps,
  type CrmPushNoteInput,
  type CrmRuntimeMode,
} from '@aisecretary/crm';
import type pino from 'pino';

export const CRM_PUSH_QUEUE = 'crm.push' as const;

export interface CrmPushJob {
  data: {
    integrationId: string;
    tenantId: string;
    meetingId: string;
    region: 'us' | 'eu';
    providerKind: 'hubspot' | 'salesforce' | 'pipedrive';
    contactEmail: string;
    contactFirstName?: string;
    contactLastName?: string;
    dealId?: string;
    createContactIfMissing: boolean;
    idempotencyKey: string;
    actorUserId: string;
  };
}

/**
 * Slim repo interface — the worker doesn't import from apps/api so we
 * inject a structural slice. Production wires
 * `DrizzleCrmIntegrationsRepository` from apps/api/routes; tests
 * inject the in-memory variant.
 */
export interface WorkerCrmIntegrationsRepository {
  findById(
    integrationId: string,
    tenantId: string,
  ): Promise<{
    id: string;
    tenantId: string;
    provider: 'hubspot' | 'salesforce' | 'pipedrive';
    instanceUrl: string | null;
    apiBaseUrl: string | null;
    status: 'active' | 'revoked' | 'error';
  } | null>;
  getDecryptedTokensForJoin(
    integrationId: string,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken?: string } | null>;
  markUsed(integrationId: string, tenantId: string, at: Date): Promise<void>;
  markError(integrationId: string, tenantId: string, reason: string): Promise<void>;
}

/**
 * Slim meetings reader — same pattern. The handler needs title +
 * date + summary + action items + a meeting URL.
 */
export interface WorkerMeetingReader {
  loadForCrmPush(
    meetingId: string,
    tenantId: string,
  ): Promise<{
    id: string;
    title: string;
    recordedAt: Date | null;
    summary: string;
    actionItems: ReadonlyArray<{ text: string; owner?: string; dueDate?: string }>;
  } | null>;
}

export interface CreateCrmPushHandlerDeps {
  integrationsRepository: WorkerCrmIntegrationsRepository;
  meetingReader: WorkerMeetingReader;
  appBaseUrl: string;
  logger: pino.Logger;
  /** Defaults to `'production'`. Tests pin `'test'` to force the mock provider. */
  mode?: CrmRuntimeMode;
  /** Audit logger fronting the worker-side audit sink. */
  auditLogger: CrmGatewayDeps['auditLogger'];
}

export const createCrmPushHandler = (deps: CreateCrmPushHandlerDeps) => {
  const mode: CrmRuntimeMode = deps.mode ?? 'production';
  const gateway = new CrmGateway({ mode, auditLogger: deps.auditLogger });

  return async (job: CrmPushJob): Promise<void> => {
    const payload = job.data;
    deps.logger.info(
      { integrationId: payload.integrationId, meetingId: payload.meetingId },
      'crm-push: handler invoked',
    );

    const integration = await deps.integrationsRepository.findById(
      payload.integrationId,
      payload.tenantId,
    );
    if (!integration) {
      deps.logger.warn({ integrationId: payload.integrationId }, 'crm-push: integration missing');
      return;
    }
    if (integration.status !== 'active') {
      deps.logger.warn(
        { integrationId: payload.integrationId, status: integration.status },
        'crm-push: integration not active — skipping',
      );
      return;
    }

    const meeting = await deps.meetingReader.loadForCrmPush(payload.meetingId, payload.tenantId);
    if (!meeting) {
      deps.logger.warn({ meetingId: payload.meetingId }, 'crm-push: meeting not found');
      return;
    }

    const tokens = await deps.integrationsRepository.getDecryptedTokensForJoin(
      payload.integrationId,
      payload.tenantId,
    );
    if (!tokens) {
      deps.logger.error(
        { integrationId: payload.integrationId },
        'crm-push: tokens unavailable for active integration',
      );
      return;
    }

    const noteInput: Omit<CrmPushNoteInput, 'contactId'> = {
      meetingTitle: meeting.title,
      meetingDate: (meeting.recordedAt ?? new Date()).toISOString(),
      summary: meeting.summary,
      actionItems: meeting.actionItems,
      meetingUrl: `${deps.appBaseUrl}/meetings/${meeting.id}`,
      idempotencyKey: payload.idempotencyKey,
    };

    try {
      await gateway.pushNote({
        tenantId: payload.tenantId,
        actorUserId: payload.actorUserId,
        selector: { providerKind: integration.provider, mode },
        factory: buildFactoryConfig(integration, tokens, payload.region),
        contactSearch: {
          email: payload.contactEmail,
          ...(payload.contactFirstName ? { firstName: payload.contactFirstName } : {}),
          ...(payload.contactLastName ? { lastName: payload.contactLastName } : {}),
        },
        createIfMissing: payload.createContactIfMissing,
        noteInput,
      });
      await deps.integrationsRepository.markUsed(
        payload.integrationId,
        payload.tenantId,
        new Date(),
      );
    } catch (err) {
      if (err instanceof CrmAuthError) {
        // Token revoked / scopes missing — flip the integration into
        // 'error' so the API + extension can surface a reconnect CTA.
        // pg-boss must NOT retry — the error is non-recoverable
        // without user action.
        await deps.integrationsRepository.markError(
          payload.integrationId,
          payload.tenantId,
          err.message,
        );
        deps.logger.warn(
          { integrationId: payload.integrationId },
          'crm-push: integration auth failed — marked error',
        );
        return;
      }
      throw err;
    }
  };
};

const buildFactoryConfig = (
  integration: {
    provider: 'hubspot' | 'salesforce' | 'pipedrive';
    instanceUrl: string | null;
    apiBaseUrl: string | null;
  },
  tokens: { accessToken: string },
  region: 'us' | 'eu',
): {
  hubspot?: { accessToken: string; region: 'us' | 'eu' };
  salesforce?: { accessToken: string; instanceUrl: string; region: 'us' | 'eu' };
  pipedrive?: { accessToken: string; apiBaseUrl: string; region: 'us' | 'eu' };
} => {
  switch (integration.provider) {
    case 'hubspot':
      return { hubspot: { accessToken: tokens.accessToken, region } };
    case 'salesforce':
      if (!integration.instanceUrl) {
        throw new Error('crm-push: salesforce integration row missing instance_url');
      }
      return {
        salesforce: {
          accessToken: tokens.accessToken,
          instanceUrl: integration.instanceUrl,
          region,
        },
      };
    case 'pipedrive':
      if (!integration.apiBaseUrl) {
        throw new Error('crm-push: pipedrive integration row missing api_base_url');
      }
      return {
        pipedrive: {
          accessToken: tokens.accessToken,
          apiBaseUrl: integration.apiBaseUrl,
          region,
        },
      };
  }
};
