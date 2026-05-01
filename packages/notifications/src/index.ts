export const PACKAGE_NAME = '@aisecretary/notifications';

// Public surface — re-exports only.
export type {
  AuditLogger,
  NotificationAuditAction,
  NotificationAuditEntry,
} from './audit.js';
export { noopAuditLogger } from './audit.js';

export type {
  EmailPayload,
  EmailProviderConfig,
  EmailProviderId,
  EmailRecipient,
  NotificationChannel,
  NotificationKind,
  NotificationPayload,
  NotificationRecipient,
  NotificationRepository,
  NotificationRequest,
  NotificationStatus,
  ProviderResult,
  PushPayload,
  PushProviderId,
  PushRecipient,
  SendResult,
  TenantNotificationSettings,
  TenantSettingsResolver,
  UserPreferencesResolver,
} from './types.js';

export {
  emailPayloadSchema,
  emailProviderIdSchema,
  emailRecipientSchema,
  notificationChannelSchema,
  notificationKindSchema,
  notificationPayloadSchema,
  notificationRecipientSchema,
  notificationRequestSchema,
  pushPayloadSchema,
  pushRecipientSchema,
} from './schemas.js';
export type { NotificationRequestInput } from './schemas.js';

export { NotificationGateway } from './gateway.js';
export type { NotificationGatewayDeps } from './gateway.js';

export {
  createNotificationSendHandler,
  QUEUE_NAME,
} from './handler.js';
export type { NotificationJob } from './handler.js';

export { ExpoPushProvider } from './providers/expo-push.js';
export type { ExpoPushProviderConfig } from './providers/expo-push.js';
export { PostmarkProvider } from './providers/postmark.js';
export type {
  PostmarkProviderConfig,
  RenderedEmailMessage,
} from './providers/postmark.js';
export { SesProvider } from './providers/ses.js';
export type { SesProviderConfig } from './providers/ses.js';
export { SmtpProvider } from './providers/smtp.js';
export type { SmtpProviderConfig } from './providers/smtp.js';

export { computeDedupKey, DEDUP_WINDOW_MS, hashPayload, recipientKey } from './dedup.js';

export { registeredEmailKinds, renderTemplate } from './templates/render.js';
export type { RenderedEmail, TemplateRenderer } from './templates/render.js';
