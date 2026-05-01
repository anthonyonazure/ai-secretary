/**
 * Consent runtime — type contracts.
 *
 * Spec source:
 *   - `_bmad-output/planning-artifacts/arch-addendums.md` § 7
 *     (Region-Aware EU Explicit-Consent Branch / ADR-0005 PROPOSED)
 *   - `_bmad-output/planning-artifacts/ux-design-specification.md`
 *     (consent shape A / shape C)
 *
 * Story 4.3 covers the user-facing surfaces (shape A pre-mic modal,
 * shape C in-person QR/URL). The full consent legal-basis state
 * machine for bot meetings (shape B / shape D) lands in Epic 9.
 */

/**
 * Participant region as resolved by `region-detect.ts`.
 * `'unknown'` is a real return — orchestrator handles the
 * conservative default (escalate to EU when tenant policy
 * defaults to `'eu'`).
 */
export type ParticipantRegion = 'us' | 'eu' | 'unknown';

/**
 * Per ADR-0005:
 *   - `'legitimate-interest'` — implicit acknowledgment via TTS / pre-mic
 *     modal; opt-out available.
 *   - `'explicit-consent'` — explicit per-participant opt-in required
 *     (EU GDPR-derived default).
 */
export type ConsentLegalBasis = 'legitimate-interest' | 'explicit-consent';

/**
 * Consent shapes per UX spec.
 * Shape A (pre-mic) and Shape C (in-person QR) are Story 4.3 surfaces.
 * Shape B / D land later (bot TTS implicit + bot chat explicit-optin).
 * `eu-explicit` is the additional surface attached when shape A runs
 * under `'explicit-consent'` legal basis.
 */
export type ConsentShape = 'A' | 'C' | 'eu-explicit' | 'B' | 'D';

/**
 * Identifies how the recording surface kicked off — drives whether
 * shape C (in-person QR) is appropriate.
 *   - `'mobile-mic'` / `'web-mic'` — first-party capture; shape C valid
 *     when the org has flagged in-person consent required.
 *   - `'bot'` — Zoom/Teams; shapes B/D apply (deferred).
 *   - `'upload'` — file upload; shape A only.
 */
export type MeetingSource = 'mobile-mic' | 'web-mic' | 'bot' | 'upload';

/**
 * Tenant-level + org-level policy knobs used to resolve the legal
 * basis for a given meeting. Source: `tenant_settings` columns
 * authored alongside Story 9.5; surfaced here as a typed contract
 * so callers can pass them in without depending on db schema.
 */
export interface ConsentPolicy {
  /** Tenant default region — drives the conservative-default rule. */
  default: 'us' | 'eu';
  /** Org-level always-explicit override; trumps every other rule. */
  alwaysExplicit?: boolean;
  /** Whether org config requires the shape C QR/URL flow for in-person captures. */
  orgInPersonRequired?: boolean;
}

/**
 * Lightweight participant descriptor used to drive region detection.
 * The fuller `meeting_participants` row (arch-addendums § 7) lands in
 * Story 9.5; this is the subset Story 4.3 needs.
 */
export interface ConsentParticipantInput {
  /** Stable identifier — userId or external participant id. */
  id?: string;
  /** Display name for UI surfaces. */
  displayName?: string;
  /** Used by region-detect (email TLD heuristic). */
  email?: string;
  /** IANA TZ from calendar; used by region-detect. */
  calendarTimezone?: string;
  /** Optional ISO 3166-1 alpha-2 from earlier metadata pass. */
  ipCountry?: string;
}

/**
 * Surface = a single consent UI requirement that must be satisfied
 * before recording can proceed. The orchestrator returns these in
 * the order they should appear.
 */
export interface ConsentSurface {
  shape: ConsentShape;
  /** Resolved legal basis at the meeting level. */
  legalBasis: ConsentLegalBasis;
  /**
   * For shape A this is the recording user; for shape C it's the
   * in-person counterpart who scans the QR.
   */
  audience: 'recording-user' | 'in-person-counterpart' | 'remote-participant';
  /** Per-participant region snapshot (only populated for `eu-explicit`). */
  participantRegions?: ReadonlyArray<{
    participantId: string;
    region: ParticipantRegion;
  }>;
}

/**
 * The acknowledgment record persisted to `consents`. Mirrors the
 * Drizzle row shape — kept here so consumers can construct without
 * importing db.
 */
export interface ConsentRecord {
  tenantId: string;
  meetingId: string;
  recipientId?: string | null;
  recipientLabel?: string | null;
  shape: ConsentShape;
  legalBasis: ConsentLegalBasis;
  acknowledgedAt: string; // ISO 8601 UTC
  acknowledgedVia: 'modal' | 'qr-scan' | 'url' | 'bot-tts';
  acknowledgedMethodMetadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Disclosure copy bundle returned by `disclosure-templates.ts`.
 * `bodyParagraphs` is split so the renderer can apply spacing tokens
 * and selectively wrap rights in plain language register.
 */
export interface DisclosureCopy {
  title: string;
  bodyParagraphs: string[];
  rightsLine: string;
  acknowledgeCta: string;
  declineCta: string;
  /** Extra paragraph when legalBasis === 'explicit-consent'. */
  euExplicitNote?: string;
  /** Checkbox label for explicit-consent affirmation. */
  euExplicitCheckboxLabel?: string;
}
