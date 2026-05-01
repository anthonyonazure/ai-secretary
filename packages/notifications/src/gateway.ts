import { type AuditLogger, type NotificationAuditAction, noopAuditLogger } from './audit.js';
import { DEDUP_WINDOW_MS, computeDedupKey, hashPayload, recipientKey } from './dedup.js';
import type { ExpoPushProvider } from './providers/expo-push.js';
import type { PostmarkProvider, RenderedEmailMessage } from './providers/postmark.js';
import type { SesProvider } from './providers/ses.js';
import type { SmtpProvider } from './providers/smtp.js';
import { renderTemplate } from './templates/render.js';
import type {
  EmailProviderId,
  NotificationRepository,
  NotificationRequest,
  ProviderResult,
  SendResult,
  TenantSettingsResolver,
  UserPreferencesResolver,
} from './types.js';

/**
 * Gateway construction inputs.
 *
 * The gateway is a *thin coordinator* — it owns dedup, opt-out
 * resolution, audit-log emission, persistence-row writes — and
 * delegates the actual transport to the provider impls passed in.
 *
 * Story 1.4 will provide:
 *   - tenant-context plugin → replaces explicit `tenantId` argument
 *     plumbing on the request side
 *   - audit-logger plugin → replaces the default no-op
 *
 * Until those land, callers wire concrete impls explicitly. See the
 * TODO markers below.
 */
export interface NotificationGatewayDeps {
  pushProvider: ExpoPushProvider;
  emailProviders: {
    postmark?: PostmarkProvider;
    ses?: SesProvider;
    smtp?: SmtpProvider;
  };
  /** Tenant settings lookup — resolves per-tenant email provider override. */
  tenantSettings: TenantSettingsResolver;
  /** Per-channel + per-kind opt-out lookup. */
  userPreferences: UserPreferencesResolver;
  /** Notifications-table repo. */
  repository: NotificationRepository;
  /**
   * Default email provider when the tenant has no override.
   * SaaS uses 'postmark'; on-prem uses 'smtp'.
   */
  defaultEmailProvider: EmailProviderId;
  /**
   * Audit-logger injection point.
   * TODO(Story 1.4): wire audit-logger plugin instance once it ships.
   */
  auditLogger?: AuditLogger;
  /** Override the dedup window (default 5 min). Tests use this. */
  dedupWindowMs?: number;
}

export class NotificationGateway {
  private readonly auditLogger: AuditLogger;
  private readonly dedupWindowMs: number;

  constructor(private readonly deps: NotificationGatewayDeps) {
    this.auditLogger = deps.auditLogger ?? noopAuditLogger;
    this.dedupWindowMs = deps.dedupWindowMs ?? DEDUP_WINDOW_MS;
  }

  /**
   * Send a single notification. Returns a `SendResult` that distinguishes
   * sent / suppressed-dedup / opted-out / failed outcomes. Never throws —
   * callers should branch on the result.
   *
   * TODO(Story 1.4): consume tenant-context plugin once it lands so
   * `req.tenantId` can be omitted and pulled from ALS.
   */
  async send(req: NotificationRequest): Promise<SendResult> {
    const payloadHash = hashPayload(req.payload);
    const dedupKey = computeDedupKey({
      kind: req.kind,
      payloadHash,
      ...(req.dedupKey !== undefined ? { callerSupplied: req.dedupKey } : {}),
    });
    const recipient = recipientKey(req.recipient);
    const channel = req.recipient.channel;

    // 1. Opt-out check (only applies when we know the userId).
    const userId = req.recipient.channel === 'push' ? req.recipient.userId : req.recipient.userId;
    if (userId) {
      const optedOut = await this.deps.userPreferences.isOptedOut({
        tenantId: req.tenantId,
        userId,
        channel,
        kind: req.kind,
      });
      if (optedOut) {
        const row = await this.deps.repository.insert({
          tenantId: req.tenantId,
          recipient,
          channel,
          kind: req.kind,
          payloadHash,
          status: 'suppressed',
          attempts: 0,
          dedupKey,
        });
        await this.emitAudit({
          action: 'notification.opted-out',
          tenantId: req.tenantId,
          userId,
          recipient,
          channel,
          kind: req.kind,
          notificationId: row.id,
        });
        return {
          ok: true,
          notificationId: row.id,
          status: 'suppressed',
          reason: 'opted-out',
        };
      }
    }

    // 2. Dedup check.
    const recentlySent = await this.deps.repository.hasRecentSend({
      tenantId: req.tenantId,
      recipient,
      kind: req.kind,
      dedupKey,
      windowMs: this.dedupWindowMs,
    });
    if (recentlySent) {
      const row = await this.deps.repository.insert({
        tenantId: req.tenantId,
        recipient,
        channel,
        kind: req.kind,
        payloadHash,
        status: 'suppressed',
        attempts: 0,
        dedupKey,
      });
      await this.emitAudit({
        action: 'notification.suppressed-dedup',
        tenantId: req.tenantId,
        userId: userId ?? undefined,
        recipient,
        channel,
        kind: req.kind,
        notificationId: row.id,
      });
      return {
        ok: true,
        notificationId: row.id,
        status: 'suppressed',
        reason: 'dedup',
      };
    }

    // 3. Persist pending row, then dispatch.
    const pending = await this.deps.repository.insert({
      tenantId: req.tenantId,
      recipient,
      channel,
      kind: req.kind,
      payloadHash,
      status: 'pending',
      attempts: 1,
      dedupKey,
    });

    const result = await this.dispatch(req);

    await this.deps.repository.updateStatus({
      id: pending.id,
      status: result.ok ? 'sent' : 'failed',
      attempts: 1,
    });

    const auditAction: NotificationAuditAction = result.ok
      ? 'notification.sent'
      : 'notification.failed';
    await this.emitAudit({
      action: auditAction,
      tenantId: req.tenantId,
      userId: userId ?? undefined,
      recipient,
      channel,
      kind: req.kind,
      notificationId: pending.id,
      providerMessageId: result.ok ? result.providerMessageId : undefined,
      error: result.ok ? undefined : result.error,
    });

    if (result.ok) {
      return {
        ok: true,
        notificationId: pending.id,
        providerMessageId: result.providerMessageId,
      };
    }
    return {
      ok: false,
      notificationId: pending.id,
      error: result.error,
      retryable: result.retryable,
    };
  }

  /** Routes to the right provider based on channel + tenant config. */
  private async dispatch(req: NotificationRequest): Promise<ProviderResult> {
    if (req.recipient.channel === 'push' && req.payload.channel === 'push') {
      return await this.deps.pushProvider.send(req.recipient, req.payload);
    }
    if (req.recipient.channel === 'email' && req.payload.channel === 'email') {
      const settings = await this.deps.tenantSettings.resolve(req.tenantId);
      const providerId = settings.notificationEmailProvider ?? this.deps.defaultEmailProvider;

      const rendered = renderTemplate(req.kind, req.payload.context, req.payload.locale ?? 'en');
      const message: RenderedEmailMessage = {
        to: req.recipient.email,
        ...(req.recipient.name ? { toName: req.recipient.name } : {}),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(req.payload.from
          ? { from: req.payload.from }
          : settings.notificationEmailFrom
            ? { from: settings.notificationEmailFrom }
            : {}),
      };
      return await this.dispatchEmail(providerId, message);
    }
    return {
      ok: false,
      error: 'recipient/payload channel mismatch',
      retryable: false,
    };
  }

  private async dispatchEmail(
    providerId: EmailProviderId,
    message: RenderedEmailMessage,
  ): Promise<ProviderResult> {
    const provider =
      providerId === 'postmark'
        ? this.deps.emailProviders.postmark
        : providerId === 'ses'
          ? this.deps.emailProviders.ses
          : this.deps.emailProviders.smtp;
    if (!provider) {
      return {
        ok: false,
        error: `email provider '${providerId}' not configured`,
        retryable: false,
      };
    }
    return await provider.send(message);
  }

  private async emitAudit(entry: {
    action: NotificationAuditAction;
    tenantId: string;
    userId?: string | undefined;
    recipient: string;
    channel: 'push' | 'email';
    kind: NotificationRequest['kind'];
    notificationId: string;
    providerMessageId?: string | undefined;
    error?: string | undefined;
  }): Promise<void> {
    await this.auditLogger.log(entry);
  }
}
