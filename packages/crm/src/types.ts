/**
 * Public contract for the CRM provider abstraction.
 *
 * Story 15.x ships:
 *   - `HubspotCrmProvider`     — direct HubSpot CRM v3 API
 *   - `SalesforceCrmProvider`  — Salesforce REST + Tooling API
 *   - `PipedriveCrmProvider`   — Pipedrive v1 API
 *   - `MockCrmProvider`        — deterministic; tests + dev
 *
 * Per-tenant provider selection lives in `selector.ts`; the gateway
 * (`gateway.ts`) calls the selector first, then asks the factory for
 * a concrete provider, then handles retry + audit.
 *
 * Per CLAUDE.md § Provider abstraction discipline, real CRM SDK
 * imports (HubSpot SDK, jsforce, Pipedrive client) stay inside this
 * package. The CI isolation gate (`scripts/check-isolation.ts`) enforces
 * the boundary.
 */

/**
 * Discriminator used by the factory + gateway logging + audit.
 */
export type CrmProviderKind = 'hubspot' | 'salesforce' | 'pipedrive' | 'mock';

/** Region the provider is scoped to. Per-region credential pinning. */
export type Region = 'us' | 'eu';

/**
 * The connected CRM account is identified by the provider-native id +
 * an opaque "portal" descriptor (HubSpot: portalId; Salesforce: orgId
 * + instance URL; Pipedrive: companyDomain). Surfaced via
 * `whoAmI()` on every provider so the API can show "Connected to
 * Acme HubSpot (12345)".
 */
export interface CrmAccount {
  providerKind: CrmProviderKind;
  accountId: string;
  /** Display label — "Acme HubSpot" / "Acme Salesforce (NA45)". */
  label: string;
  /** Provider-native instance URL when applicable (e.g. Salesforce). */
  instanceUrl?: string;
}

/**
 * Minimal contact shape — what the AI Secretary push surface needs to
 * find an existing contact (or create a new one) in the CRM.
 */
export interface CrmContactSearchInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface CrmContactRef {
  id: string;
  email: string;
  /** Display name — "Jane Doe" / "Bob (no name on record)". */
  displayName: string;
}

/**
 * Push payload — what gets attached to a contact / deal as a note.
 *
 * The note content is plain text + optional structured action items.
 * Each provider renders these into its native note format (HubSpot
 * Engagement Notes, Salesforce Activities, Pipedrive Notes).
 *
 * `meetingUrl` is the deep-link back into AI Secretary (`/meetings/:id`)
 * so a CRM user can click through to the full receipt.
 */
export interface CrmPushNoteInput {
  contactId: string;
  /** Optional deal/opportunity id to attach the note to. */
  dealId?: string;
  meetingTitle: string;
  /** ISO 8601 string. */
  meetingDate: string;
  /** Plain-text summary (no markdown — CRMs render varies). */
  summary: string;
  /** Action items extracted from the meeting. */
  actionItems: ReadonlyArray<{
    text: string;
    owner?: string;
    dueDate?: string;
  }>;
  /** Deep-link back into AI Secretary. */
  meetingUrl: string;
  /**
   * Idempotency key. The provider stores this on the note's external
   * metadata; on duplicate push (same key), the provider updates the
   * existing note instead of creating a new one.
   */
  idempotencyKey: string;
}

export interface CrmPushResult {
  /** Provider-native note id (HubSpot engagement id, etc.). */
  noteId: string;
  /** Provider URL pointing at the note. */
  noteUrl?: string;
  /** Whether this push created a new note or updated an existing one. */
  created: boolean;
}

/**
 * The unified CRM provider interface. Each concrete provider
 * implements this against its native SDK.
 */
export interface CrmProvider {
  readonly kind: CrmProviderKind;

  /** Verify credentials + return account label for display. */
  whoAmI(): Promise<CrmAccount>;

  /**
   * Find a contact by email. Returns null when the contact doesn't
   * exist (callers may then call `createContact()` if creating on push
   * is enabled).
   */
  findContactByEmail(input: CrmContactSearchInput): Promise<CrmContactRef | null>;

  /** Create a contact. Used when push-with-create is enabled. */
  createContact(input: CrmContactSearchInput): Promise<CrmContactRef>;

  /**
   * Push a meeting note to the contact (and optionally to a deal).
   * Idempotent — re-pushing with the same `idempotencyKey` updates
   * the existing note instead of creating a duplicate.
   */
  pushNote(input: CrmPushNoteInput): Promise<CrmPushResult>;
}

/**
 * Audit-action union — every state-changing CRM operation maps to one
 * of these. Wired into `apps/api/src/lib/audit-types.ts`.
 */
export type CrmAuditAction =
  | 'crm.connected'
  | 'crm.disconnected'
  | 'crm.note-pushed'
  | 'crm.contact-created'
  | 'crm.push-failed';

export const CRM_AUDIT_ACTIONS: ReadonlyArray<CrmAuditAction> = [
  'crm.connected',
  'crm.disconnected',
  'crm.note-pushed',
  'crm.contact-created',
  'crm.push-failed',
];
