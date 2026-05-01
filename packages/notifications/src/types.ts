/**
 * Provider-agnostic notification surface for `packages/notifications`.
 *
 * Per `arch-addendums.md` § 5: this is the single sanctioned surface for
 * push + email dispatch. The gateway (gateway.ts) selects providers per
 * tenant config and routes through this contract.
 */

/** Channel = transport. Add 'sms' here when Twilio provider lands. */
export type NotificationChannel = 'push' | 'email';

/**
 * Kind = product-level event. Drives template selection (email) and
 * payload shape (push body / data). Add new kinds for new product
 * surfaces — never reuse a kind across unrelated events.
 *
 * Mapped to consumers in arch-addendums § 5 "Consumers" table:
 *  - re-engagement-24h / re-engagement-72h        → Story 1.7
 *  - capture-at-risk                              → Story 4.4
 *  - upload-retry-exhausted                       → Story 4.5
 *  - bot-join-failed                              → Story 9.6
 *  - trial-ending-soon / trial-expired            → Story 13.7
 *  - dsar-ready                                   → Story 14.1
 *  - share-received-slack / share-received-teams  → Story 15.5
 *  - analysis-completed                           → Story 15.6
 */
export type NotificationKind =
  | 're-engagement-24h'
  | 're-engagement-72h'
  | 'capture-at-risk'
  | 'upload-retry-exhausted'
  | 'bot-join-failed'
  | 'trial-ending-soon'
  | 'trial-expired'
  | 'dsar-ready'
  // Story 14.1 — DSAR worker failure path. Template not yet registered;
  // gateway emits a structured log + dead-letters dispatch until 14.x adds one.
  | 'dsar-failed'
  | 'share-received-slack'
  | 'share-received-teams'
  | 'analysis-completed'
  // Story 1.5d — admin invites a new org member.
  | 'tenant-invite'
  // Story 15.x — hub-app dispatch event types. Slack/Teams kinds use
  // their own webhook surface (separate from email + push); the LMS
  // and CRM kinds dispatch to the hub-app's configured webhook URL.
  | 'meeting-receipt-slack'
  | 'meeting-receipt-teams'
  | 'meeting-receipt-crm-note'
  | 'lms-grade-passback'
  | 'lms-deeplink-launched';

/**
 * Email-provider id. Resolved per tenant via
 * `tenant_settings.notification_email_provider`. SaaS default = postmark;
 * on-prem default = smtp. SES is the SaaS fallback when Postmark trips.
 */
export type EmailProviderId = 'postmark' | 'ses' | 'smtp';

/** Push-provider id. Currently single-impl (Expo). */
export type PushProviderId = 'expo';

/** Status persisted to the `notifications` table. */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'suppressed';

/**
 * A push recipient. The gateway looks up the user's Expo push token(s)
 * from the device-registration substrate (added by Story 4.4 — pre-then,
 * the caller passes pre-resolved tokens directly via `pushTokens`).
 */
export interface PushRecipient {
  channel: 'push';
  userId: string;
  /** Pre-resolved Expo push tokens. Caller provides until device-token table lands. */
  pushTokens: string[];
}

/** An email recipient — explicit address (not auto-resolved from user row). */
export interface EmailRecipient {
  channel: 'email';
  /** RFC 5321 address. Trim/normalize at the call site. */
  email: string;
  /** Optional userId for opt-out lookup + audit-log linkage. */
  userId?: string;
  /** Optional human-readable name for `To:` header. */
  name?: string;
}

export type NotificationRecipient = PushRecipient | EmailRecipient;

/**
 * Push-channel payload. Title + body always; `data` is opaque
 * forwarded-to-app payload (deep-link, meeting id, etc.).
 */
export interface PushPayload {
  channel: 'push';
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
}

/**
 * Email-channel payload. The gateway *renders* templates via
 * `templates/render.ts` before handing off to a provider — callers pass
 * the kind + context, not pre-rendered subject/html.
 */
export interface EmailPayload {
  channel: 'email';
  /** Locale code (BCP 47) — i18next-keyed template variants. Defaults to 'en'. */
  locale?: string;
  /** Template-specific variables; each template file documents its own shape. */
  context: Record<string, unknown>;
  /** Optional explicit From override. Otherwise tenant's configured sender. */
  from?: string;
}

export type NotificationPayload = PushPayload | EmailPayload;

/**
 * The full notification envelope handed to the gateway. tenantId is
 * passed explicitly because Story 1.4 (tenant-context plugin) does not
 * yet exist — once it lands, the gateway will pull tenantId from the
 * ALS/Postgres setting instead.
 */
export interface NotificationRequest {
  tenantId: string;
  kind: NotificationKind;
  recipient: NotificationRecipient;
  payload: NotificationPayload;
  /**
   * Caller-supplied dedup discriminator. Hashed with `(recipient, kind)`
   * to form the dedup-window key. Example for capture-at-risk:
   * `recordingId`. Defaults to a stable hash of the payload.
   */
  dedupKey?: string;
}

/**
 * Result from a single provider dispatch. We never throw — providers
 * surface errors as typed results so the gateway can decide whether to
 * retry or mark failed.
 */
export type ProviderResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

/** Result returned from the gateway send call. */
export type SendResult =
  | { ok: true; notificationId: string; providerMessageId: string }
  | { ok: true; notificationId: string; status: 'suppressed'; reason: 'dedup' | 'opted-out' }
  | { ok: false; notificationId: string; error: string; retryable: boolean };

/**
 * Email-provider config. Each provider's adapter consumes its own
 * subset; the gateway hands the full record over and lets the adapter
 * pluck what it needs at construction time.
 */
export interface EmailProviderConfig {
  postmark?: { apiToken: string; defaultFrom: string };
  ses?: { region: string; defaultFrom: string };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
    defaultFrom: string;
  };
}

/** Tenant-resolved settings the gateway consults at dispatch time. */
export interface TenantNotificationSettings {
  tenantId: string;
  /** Per-tenant email provider selection. Falls back to gateway default. */
  notificationEmailProvider?: EmailProviderId;
  /** Per-tenant From override (e.g. `Acme <noreply@acme.com>`). */
  notificationEmailFrom?: string;
}

/**
 * The provider-resolution interface. Production wires this to a DB read
 * against `tenant_settings`; tests inject a stub. Kept pluggable to
 * avoid requiring a live DB in unit tests.
 */
export interface TenantSettingsResolver {
  resolve(tenantId: string): Promise<TenantNotificationSettings>;
}

/**
 * The user-preferences interface. Production wires this to a DB read
 * against `user_preferences` (this package's table). Tests inject a stub.
 */
export interface UserPreferencesResolver {
  /**
   * Returns true if the user has opted out of `(channel, kind)`. Missing
   * row = not opted out = false.
   */
  isOptedOut(args: {
    tenantId: string;
    userId: string;
    channel: NotificationChannel;
    kind: NotificationKind;
  }): Promise<boolean>;
}

/**
 * Persistence interface — gateway writes one row to `notifications`
 * per send (regardless of suppression). Production wires this to a
 * Drizzle insert; tests use an in-memory map.
 */
export interface NotificationRepository {
  insert(row: {
    tenantId: string;
    recipient: string;
    channel: NotificationChannel;
    kind: NotificationKind;
    payloadHash: string;
    status: NotificationStatus;
    attempts: number;
    dedupKey: string;
  }): Promise<{ id: string }>;
  /**
   * Returns true if a `(recipient, kind, dedupKey)` row was inserted in
   * the last `windowMs` (default 5 min — see arch-addendums § 5). Used
   * to suppress repeats.
   */
  hasRecentSend(args: {
    tenantId: string;
    recipient: string;
    kind: NotificationKind;
    dedupKey: string;
    windowMs: number;
  }): Promise<boolean>;
  updateStatus(args: {
    id: string;
    status: NotificationStatus;
    attempts?: number;
  }): Promise<void>;
}
