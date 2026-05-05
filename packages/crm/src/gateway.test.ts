import { describe, expect, it, vi } from 'vitest';

import { CrmAuthError, CrmRateLimitError } from './errors.js';
import { type CrmAuditLogger, CrmGateway } from './gateway.js';
import { MockCrmProvider } from './providers/mock.js';

const buildLogger = (): {
  logs: Parameters<CrmAuditLogger['log']>[0][];
  logger: CrmAuditLogger;
} => {
  const logs: Parameters<CrmAuditLogger['log']>[0][] = [];
  return {
    logs,
    logger: {
      async log(input) {
        logs.push(input);
      },
    },
  };
};

const baseNoteInput = {
  meetingTitle: 'Q4 Sync',
  meetingDate: '2026-05-05T16:30:00.000Z',
  summary: 'We aligned on the launch timeline.',
  actionItems: [{ text: 'Send kickoff doc', owner: 'Alice', dueDate: '2026-05-08' }],
  meetingUrl: 'https://app.aisecretary.app/meetings/abc',
  idempotencyKey: 'meeting-abc-push-1',
} as const;

describe('CrmGateway.pushNote', () => {
  it('finds existing contact, pushes note, audits both events on first push', async () => {
    const mock = new MockCrmProvider();
    mock.seedContact({ id: 'contact-1', email: 'jane@acme.com', displayName: 'Jane Doe' });
    const { logs, logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    const out = await gateway.pushNote({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'jane@acme.com' },
      createIfMissing: false,
      noteInput: baseNoteInput,
    });

    expect(out.contact.id).toBe('contact-1');
    expect(out.result.created).toBe(true);
    expect(mock.pushedNotes).toHaveLength(1);

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('crm.note-pushed');
    expect(actions).not.toContain('crm.contact-created');
  });

  it('creates contact then pushes when createIfMissing=true', async () => {
    const mock = new MockCrmProvider();
    const { logs, logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    const out = await gateway.pushNote({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'new@acme.com', firstName: 'New', lastName: 'Person' },
      createIfMissing: true,
      noteInput: baseNoteInput,
    });

    expect(out.contact.email).toBe('new@acme.com');
    const actions = logs.map((l) => l.action);
    expect(actions).toEqual(['crm.contact-created', 'crm.note-pushed']);
  });

  it('throws + audits crm.push-failed when contact missing and createIfMissing=false', async () => {
    const mock = new MockCrmProvider();
    const { logs, logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    await expect(
      gateway.pushNote({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        selector: { providerKind: 'mock', mode: 'test' },
        factory: { mock },
        contactSearch: { email: 'missing@acme.com' },
        createIfMissing: false,
        noteInput: baseNoteInput,
      }),
    ).rejects.toThrow(/not found/i);
    expect(logs.some((l) => l.action === 'crm.push-failed')).toBe(true);
  });

  it('retries on CrmRateLimitError and succeeds on the second attempt', async () => {
    const mock = new MockCrmProvider();
    mock.seedContact({ id: 'c-1', email: 'a@a.com', displayName: 'A' });
    mock.failNextCall = 'rateLimit';
    const sleep = vi.fn(async () => {});
    const { logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger, maxRetries: 2, sleep });

    const out = await gateway.pushNote({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'a@a.com' },
      createIfMissing: false,
      noteInput: baseNoteInput,
    });

    expect(out.result.created).toBe(true);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('does NOT retry on CrmAuthError', async () => {
    const mock = new MockCrmProvider();
    mock.seedContact({ id: 'c-1', email: 'a@a.com', displayName: 'A' });
    mock.failNextCall = 'auth';
    const sleep = vi.fn(async () => {});
    const { logs, logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger, maxRetries: 3, sleep });

    await expect(
      gateway.pushNote({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        selector: { providerKind: 'mock', mode: 'test' },
        factory: { mock },
        contactSearch: { email: 'a@a.com' },
        createIfMissing: false,
        noteInput: baseNoteInput,
      }),
    ).rejects.toBeInstanceOf(CrmAuthError);
    expect(sleep).not.toHaveBeenCalled();
    expect(logs.some((l) => l.action === 'crm.push-failed')).toBe(true);
  });

  it('idempotent re-push with same key updates existing note (created=false)', async () => {
    const mock = new MockCrmProvider();
    mock.seedContact({ id: 'c-1', email: 'a@a.com', displayName: 'A' });
    const { logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    const first = await gateway.pushNote({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'a@a.com' },
      createIfMissing: false,
      noteInput: baseNoteInput,
    });
    const second = await gateway.pushNote({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'a@a.com' },
      createIfMissing: false,
      noteInput: baseNoteInput,
    });

    expect(first.result.created).toBe(true);
    expect(second.result.created).toBe(false);
    expect(second.result.noteId).toBe(first.result.noteId);
    expect(mock.pushedNotes).toHaveLength(1);
  });
});

describe('CrmGateway.whoAmI', () => {
  it('returns the account label from the selected provider', async () => {
    const mock = new MockCrmProvider({ accountLabel: 'Acme HubSpot' });
    const { logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    const account = await gateway.whoAmI({
      tenantId: 't-1',
      actorUserId: 'u-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
    });

    expect(account.label).toBe('Acme HubSpot');
    expect(account.providerKind).toBe('mock');
  });

  it('surfaces CrmAuthError from a revoked provider', async () => {
    const mock = new MockCrmProvider({ failWhoAmI: true });
    const { logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger });

    await expect(
      gateway.whoAmI({
        tenantId: 't-1',
        actorUserId: 'u-1',
        selector: { providerKind: 'mock', mode: 'test' },
        factory: { mock },
      }),
    ).rejects.toBeInstanceOf(CrmAuthError);
  });
});

describe('selector', () => {
  it('forces mock in test mode regardless of providerKind', async () => {
    const { selectCrmProviderKind } = await import('./selector.js');
    expect(selectCrmProviderKind({ providerKind: 'hubspot', mode: 'test' })).toBe('mock');
    expect(selectCrmProviderKind({ providerKind: 'salesforce', mode: 'production' })).toBe(
      'salesforce',
    );
    expect(selectCrmProviderKind({ providerKind: 'pipedrive', mode: 'dev', forceMock: true })).toBe(
      'mock',
    );
  });
});

describe('rate-limit retry-after honors provider hint', () => {
  it('sleeps the provider-supplied retryAfterMs', async () => {
    const mock = new MockCrmProvider();
    mock.seedContact({ id: 'c-1', email: 'a@a.com', displayName: 'A' });
    mock.failNextCall = 'rateLimit';
    const sleep = vi.fn(async () => {});
    const { logger } = buildLogger();
    const gateway = new CrmGateway({ mode: 'test', auditLogger: logger, sleep });

    await gateway.pushNote({
      tenantId: 't-1',
      actorUserId: 'u-1',
      selector: { providerKind: 'mock', mode: 'test' },
      factory: { mock },
      contactSearch: { email: 'a@a.com' },
      createIfMissing: false,
      noteInput: baseNoteInput,
    });

    // MockCrmProvider sets retryAfterMs to 1000.
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});

describe('rate-limit error type tracks retryAfter', () => {
  it('CrmRateLimitError exposes retryAfterMs', () => {
    const err = new CrmRateLimitError('hubspot', 5000);
    expect(err.retryAfterMs).toBe(5000);
    expect(err.retryable).toBe(true);
  });
});
