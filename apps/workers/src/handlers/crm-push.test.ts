import type { CrmAuditLogger } from '@aisecretary/crm';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type CrmPushJob,
  type WorkerCrmIntegrationsRepository,
  type WorkerMeetingReader,
  createCrmPushHandler,
} from './crm-push.js';

const silentLogger = pino({ level: 'silent' });

const buildAuditLogger = (): CrmAuditLogger => ({
  async log() {},
});

const buildIntegrationsRepo = (overrides?: Partial<WorkerCrmIntegrationsRepository>) => {
  const stored: Record<string, { status: 'active' | 'revoked' | 'error'; reason?: string }> = {};
  const repo: WorkerCrmIntegrationsRepository = {
    async findById(integrationId, tenantId) {
      const s = stored[integrationId] ?? { status: 'active' };
      void tenantId;
      return {
        id: integrationId,
        tenantId,
        provider: 'hubspot',
        instanceUrl: null,
        apiBaseUrl: null,
        status: s.status,
      };
    },
    async getDecryptedTokensForJoin() {
      return { accessToken: 'tok' };
    },
    async markUsed() {},
    async markError(integrationId, _tenantId, reason) {
      stored[integrationId] = { status: 'error', reason };
    },
    ...overrides,
  };
  return { repo, stored };
};

const buildMeetingReader = (): WorkerMeetingReader => ({
  async loadForCrmPush(meetingId, tenantId) {
    void tenantId;
    return {
      id: meetingId,
      title: 'Mock meeting',
      recordedAt: new Date('2026-05-05T16:00:00Z'),
      summary: 'We aligned on the launch timeline.',
      actionItems: [{ text: 'Send kickoff doc', owner: 'Alice' }],
    };
  },
});

const buildJob = (overrides?: Partial<CrmPushJob['data']>): CrmPushJob => ({
  data: {
    integrationId: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000abc',
    meetingId: '00000000-0000-0000-0000-000000000def',
    region: 'us',
    providerKind: 'hubspot',
    contactEmail: 'jane@acme.com',
    createContactIfMissing: true,
    idempotencyKey: 'mtg-1:int-1:jane@acme.com',
    actorUserId: '00000000-0000-0000-0000-0000000000aa',
    ...overrides,
  },
});

describe('crm-push handler', () => {
  it('skips when the integration is missing', async () => {
    const { repo } = buildIntegrationsRepo({
      async findById() {
        return null;
      },
    });
    const handler = createCrmPushHandler({
      integrationsRepository: repo,
      meetingReader: buildMeetingReader(),
      appBaseUrl: 'https://app.aisecretary.app',
      logger: silentLogger,
      mode: 'test',
      auditLogger: buildAuditLogger(),
    });
    await expect(handler(buildJob())).resolves.toBeUndefined();
  });

  it('skips when the integration is not active', async () => {
    const { repo } = buildIntegrationsRepo({
      async findById(integrationId, tenantId) {
        return {
          id: integrationId,
          tenantId,
          provider: 'hubspot',
          instanceUrl: null,
          apiBaseUrl: null,
          status: 'revoked',
        };
      },
    });
    const handler = createCrmPushHandler({
      integrationsRepository: repo,
      meetingReader: buildMeetingReader(),
      appBaseUrl: 'https://app.aisecretary.app',
      logger: silentLogger,
      mode: 'test',
      auditLogger: buildAuditLogger(),
    });
    await expect(handler(buildJob())).resolves.toBeUndefined();
  });

  it('skips when the meeting is missing', async () => {
    const { repo } = buildIntegrationsRepo();
    const reader: WorkerMeetingReader = {
      async loadForCrmPush() {
        return null;
      },
    };
    const handler = createCrmPushHandler({
      integrationsRepository: repo,
      meetingReader: reader,
      appBaseUrl: 'https://app.aisecretary.app',
      logger: silentLogger,
      mode: 'test',
      auditLogger: buildAuditLogger(),
    });
    await expect(handler(buildJob())).resolves.toBeUndefined();
  });

  it('completes happily in test mode (mock provider)', async () => {
    const { repo } = buildIntegrationsRepo();
    const markUsed = vi.fn(async () => {});
    repo.markUsed = markUsed;
    const handler = createCrmPushHandler({
      integrationsRepository: repo,
      meetingReader: buildMeetingReader(),
      appBaseUrl: 'https://app.aisecretary.app',
      logger: silentLogger,
      mode: 'test',
      auditLogger: buildAuditLogger(),
    });
    await handler(buildJob());
    expect(markUsed).toHaveBeenCalledOnce();
  });
});
