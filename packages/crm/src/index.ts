/**
 * `@aisecretary/crm` — CRM provider gateway.
 *
 * Server-side gateway for HubSpot, Salesforce, and Pipedrive (per
 * ADR-0003). Browser/extension code never imports from this package
 * directly; it goes through `apps/api/src/routes/crm.ts`.
 *
 * Provider isolation: HubSpot/Salesforce/Pipedrive SDK imports stay
 * inside `packages/crm` only. CI gate at `scripts/check-isolation.ts`.
 */

export const PACKAGE_NAME = '@aisecretary/crm';

export type {
  CrmAccount,
  CrmAuditAction,
  CrmContactRef,
  CrmContactSearchInput,
  CrmProvider,
  CrmProviderKind,
  CrmPushNoteInput,
  CrmPushResult,
  Region,
} from './types.js';
export { CRM_AUDIT_ACTIONS } from './types.js';

export {
  CrmAuthError,
  CrmError,
  CrmProviderUnavailableError,
  CrmRateLimitError,
  CrmRequestError,
  CrmServerError,
} from './errors.js';

export { createCrmProvider } from './factory.js';
export type { CrmProviderFactoryInput } from './factory.js';

export { selectCrmProviderKind } from './selector.js';
export type { CrmRuntimeMode, CrmSelectorInput } from './selector.js';

export { CrmGateway } from './gateway.js';
export type {
  CrmAuditLogger,
  CrmAuditLogInput,
  CrmGatewayDeps,
  CrmPushArgs,
} from './gateway.js';

export { MockCrmProvider } from './providers/mock.js';
export type { MockCrmProviderOptions } from './providers/mock.js';
export { HubspotCrmProvider } from './providers/hubspot.js';
export type { HubspotCrmProviderConfig } from './providers/hubspot.js';
export { SalesforceCrmProvider } from './providers/salesforce.js';
export type { SalesforceCrmProviderConfig } from './providers/salesforce.js';
export { PipedriveCrmProvider } from './providers/pipedrive.js';
export type { PipedriveCrmProviderConfig } from './providers/pipedrive.js';
