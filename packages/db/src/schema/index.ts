// Re-export every schema module so consumers can `import { meetings } from '@aisecretary/db/schema'`.
// Add new tables by creating a file in this folder and re-exporting here.

export * from './tenants.js';
export * from './users.js';
export * from './meetings.js';
export * from './notifications.js';
export * from './audit-logs.js';
export * from './consents.js';
export * from './recordings.js';
export * from './speaker-turns.js';
export * from './feedback-thumbs.js';
export * from './tenant-invites.js';
export * from './tenant-entitlements.js';
export * from './dsar-requests.js';
export * from './module-outputs.js';
export * from './action-items.js';
export * from './shares.js';
export * from './inbound-shares.js';
export * from './auth-identities.js';
export * from './embeddings.js';
export * from './bot-sessions.js';
export * from './tenant-integrations.js';
