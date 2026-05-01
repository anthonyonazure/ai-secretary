import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogger, NotificationAuditEntry } from './audit.js';
import { NotificationGateway } from './gateway.js';
import { ExpoPushProvider } from './providers/expo-push.js';
import { PostmarkProvider } from './providers/postmark.js';
import { SmtpProvider } from './providers/smtp.js';
import type {
  NotificationChannel,
  NotificationKind,
  NotificationRepository,
  NotificationStatus,
  ProviderResult,
  TenantNotificationSettings,
  TenantSettingsResolver,
  UserPreferencesResolver,
} from './types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

interface InMemoryRow {
  id: string;
  tenantId: string;
  recipient: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  dedupKey: string;
  status: NotificationStatus;
  createdAtMs: number;
}

const createInMemoryRepo = (): NotificationRepository & { rows: InMemoryRow[] } => {
  const rows: InMemoryRow[] = [];
  let counter = 0;
  return {
    rows,
    async insert(row) {
      counter += 1;
      const r: InMemoryRow = {
        id: `row-${counter}`,
        tenantId: row.tenantId,
        recipient: row.recipient,
        channel: row.channel,
        kind: row.kind,
        dedupKey: row.dedupKey,
        status: row.status,
        createdAtMs: Date.now(),
      };
      rows.push(r);
      return { id: r.id };
    },
    async hasRecentSend(args) {
      const cutoff = Date.now() - args.windowMs;
      return rows.some(
        (r) =>
          r.tenantId === args.tenantId &&
          r.recipient === args.recipient &&
          r.kind === args.kind &&
          r.dedupKey === args.dedupKey &&
          r.status === 'sent' &&
          r.createdAtMs >= cutoff,
      );
    },
    async updateStatus(args) {
      const row = rows.find((r) => r.id === args.id);
      if (row) row.status = args.status;
    },
  };
};

const createTenantSettings = (
  override?: Partial<TenantNotificationSettings>,
): TenantSettingsResolver => ({
  async resolve(tenantId) {
    return { tenantId, ...override };
  },
});

const createUserPrefs = (optedOut = false): UserPreferencesResolver => ({
  async isOptedOut() {
    return optedOut;
  },
});

const createAuditLogger = (): AuditLogger & { entries: NotificationAuditEntry[] } => {
  const entries: NotificationAuditEntry[] = [];
  return {
    entries,
    async log(entry) {
      entries.push(entry);
    },
  };
};

describe('NotificationGateway — push', () => {
  it('routes push to ExpoPushProvider and emits notification.sent audit', async () => {
    const repo = createInMemoryRepo();
    const audit = createAuditLogger();

    const pushProvider = new ExpoPushProvider({ testMode: true });
    const sendSpy = vi
      .spyOn(pushProvider, 'send')
      .mockResolvedValue({ ok: true, providerMessageId: 'expo-msg-1' } satisfies ProviderResult);

    const gateway = new NotificationGateway({
      pushProvider,
      emailProviders: {},
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'smtp',
      auditLogger: audit,
    });

    const result = await gateway.send({
      tenantId: TENANT_ID,
      kind: 'capture-at-risk',
      recipient: { channel: 'push', userId: USER_ID, pushTokens: ['ExponentPushToken[a]'] },
      payload: { channel: 'push', title: 'At risk', body: 'Recording stalled' },
      dedupKey: 'recording-1',
    });

    expect(sendSpy).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok && 'providerMessageId' in result) {
      expect(result.providerMessageId).toBe('expo-msg-1');
    }
    const sentEntry = audit.entries.find((e) => e.action === 'notification.sent');
    expect(sentEntry).toBeDefined();
    expect(sentEntry?.kind).toBe('capture-at-risk');
    expect(repo.rows.find((r) => r.status === 'sent')).toBeDefined();
  });

  it('suppresses repeat sends within dedup window', async () => {
    const repo = createInMemoryRepo();
    const audit = createAuditLogger();

    const pushProvider = new ExpoPushProvider({ testMode: true });
    vi.spyOn(pushProvider, 'send').mockResolvedValue({
      ok: true,
      providerMessageId: 'expo-msg-1',
    });

    const gateway = new NotificationGateway({
      pushProvider,
      emailProviders: {},
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'smtp',
      auditLogger: audit,
    });

    const req = {
      tenantId: TENANT_ID,
      kind: 'capture-at-risk' as const,
      recipient: {
        channel: 'push' as const,
        userId: USER_ID,
        pushTokens: ['ExponentPushToken[a]'],
      },
      payload: { channel: 'push' as const, title: 'At risk', body: 'Recording stalled' },
      dedupKey: 'recording-1',
    };

    await gateway.send(req);
    const second = await gateway.send(req);

    expect(second.ok).toBe(true);
    if (second.ok && 'status' in second) {
      expect(second.status).toBe('suppressed');
      expect(second.reason).toBe('dedup');
    }
    const dedupEntry = audit.entries.find((e) => e.action === 'notification.suppressed-dedup');
    expect(dedupEntry).toBeDefined();
  });

  it('respects user opt-out and does not call provider', async () => {
    const repo = createInMemoryRepo();
    const audit = createAuditLogger();

    const pushProvider = new ExpoPushProvider({ testMode: true });
    const sendSpy = vi.spyOn(pushProvider, 'send').mockResolvedValue({
      ok: true,
      providerMessageId: 'expo-msg-1',
    });

    const gateway = new NotificationGateway({
      pushProvider,
      emailProviders: {},
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(true),
      repository: repo,
      defaultEmailProvider: 'smtp',
      auditLogger: audit,
    });

    const result = await gateway.send({
      tenantId: TENANT_ID,
      kind: 'capture-at-risk',
      recipient: { channel: 'push', userId: USER_ID, pushTokens: ['ExponentPushToken[a]'] },
      payload: { channel: 'push', title: 'At risk', body: 'Recording stalled' },
    });

    expect(sendSpy).not.toHaveBeenCalled();
    if (result.ok && 'status' in result) {
      expect(result.status).toBe('suppressed');
      expect(result.reason).toBe('opted-out');
    }
    const optedOutEntry = audit.entries.find((e) => e.action === 'notification.opted-out');
    expect(optedOutEntry).toBeDefined();
  });

  it('marks failed result + audit when provider returns error', async () => {
    const repo = createInMemoryRepo();
    const audit = createAuditLogger();

    const pushProvider = new ExpoPushProvider({ testMode: true });
    vi.spyOn(pushProvider, 'send').mockResolvedValue({
      ok: false,
      error: 'token invalid',
      retryable: false,
    });

    const gateway = new NotificationGateway({
      pushProvider,
      emailProviders: {},
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'smtp',
      auditLogger: audit,
    });

    const result = await gateway.send({
      tenantId: TENANT_ID,
      kind: 'capture-at-risk',
      recipient: { channel: 'push', userId: USER_ID, pushTokens: ['ExponentPushToken[a]'] },
      payload: { channel: 'push', title: 'At risk', body: 'Recording stalled' },
    });

    expect(result.ok).toBe(false);
    const failedEntry = audit.entries.find((e) => e.action === 'notification.failed');
    expect(failedEntry).toBeDefined();
    expect(failedEntry?.error).toBe('token invalid');
    expect(repo.rows.find((r) => r.status === 'failed')).toBeDefined();
  });
});

describe('NotificationGateway — email routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes to per-tenant override when set', async () => {
    const repo = createInMemoryRepo();
    const audit = createAuditLogger();

    const postmark = new PostmarkProvider({
      apiToken: 'x',
      defaultFrom: 'noreply@aisecretary.app',
      testMode: true,
    });
    const smtp = new SmtpProvider({
      host: 'localhost',
      port: 25,
      secure: false,
      defaultFrom: 'noreply@aisecretary.app',
      testMode: true,
    });
    const postmarkSpy = vi.spyOn(postmark, 'send').mockResolvedValue({
      ok: true,
      providerMessageId: 'pm-1',
    });
    const smtpSpy = vi.spyOn(smtp, 'send').mockResolvedValue({
      ok: true,
      providerMessageId: 'smtp-1',
    });

    const gateway = new NotificationGateway({
      pushProvider: new ExpoPushProvider({ testMode: true }),
      emailProviders: { postmark, smtp },
      tenantSettings: createTenantSettings({ notificationEmailProvider: 'smtp' }),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'postmark',
      auditLogger: audit,
    });

    await gateway.send({
      tenantId: TENANT_ID,
      kind: 're-engagement-24h',
      recipient: { channel: 'email', email: 'user@example.com', userId: USER_ID },
      payload: {
        channel: 'email',
        context: { userName: 'A', tenantName: 'Acme', resumeUrl: 'https://x.test' },
      },
    });

    expect(postmarkSpy).not.toHaveBeenCalled();
    expect(smtpSpy).toHaveBeenCalledOnce();
  });

  it('falls back to default provider when tenant has no override', async () => {
    const repo = createInMemoryRepo();

    const postmark = new PostmarkProvider({
      apiToken: 'x',
      defaultFrom: 'noreply@aisecretary.app',
      testMode: true,
    });
    const postmarkSpy = vi.spyOn(postmark, 'send').mockResolvedValue({
      ok: true,
      providerMessageId: 'pm-1',
    });

    const gateway = new NotificationGateway({
      pushProvider: new ExpoPushProvider({ testMode: true }),
      emailProviders: { postmark },
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'postmark',
    });

    await gateway.send({
      tenantId: TENANT_ID,
      kind: 're-engagement-24h',
      recipient: { channel: 'email', email: 'user@example.com' },
      payload: {
        channel: 'email',
        context: { userName: 'A', tenantName: 'Acme', resumeUrl: 'https://x.test' },
      },
    });

    expect(postmarkSpy).toHaveBeenCalledOnce();
  });

  it('returns failure result when configured provider is missing', async () => {
    const repo = createInMemoryRepo();

    const gateway = new NotificationGateway({
      pushProvider: new ExpoPushProvider({ testMode: true }),
      emailProviders: {}, // none configured
      tenantSettings: createTenantSettings(),
      userPreferences: createUserPrefs(false),
      repository: repo,
      defaultEmailProvider: 'postmark',
    });

    const result = await gateway.send({
      tenantId: TENANT_ID,
      kind: 're-engagement-24h',
      recipient: { channel: 'email', email: 'user@example.com' },
      payload: {
        channel: 'email',
        context: { userName: 'A', tenantName: 'Acme', resumeUrl: 'https://x.test' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("email provider 'postmark' not configured");
    }
  });
});
