/**
 * Public contract for the calendar provider abstraction (Story 10.1).
 *
 * Day-1 implementation:
 *   - `NylasCalendarProvider` — covers Google + Microsoft + Exchange +
 *     iCloud via Nylas's unified API
 *   - `MockCalendarProvider` — deterministic; tests + dev
 *
 * The abstraction is narrow on purpose: the bot scheduler (Story 9.4)
 * only needs upcoming events + an opt-in flag per event. Calendar
 * write-back, attendee enrichment, and conflict detection ship in
 * follow-up slices that extend this contract.
 *
 * Provider-isolation discipline (CLAUDE.md): the Nylas SDK is
 * imported only inside `packages/calendar`. Same grep-gate as
 * `packages/llm-gateway` / `packages/transcription`.
 */

export type CalendarProviderKind = 'nylas' | 'mock';

export type CalendarSourceKind = 'google' | 'microsoft' | 'exchange' | 'icloud';

export interface CalendarEvent {
  /** Stable id from the upstream provider — primary key for upsert. */
  id: string;
  /** RFC 5322 / iCalendar UID — survives across providers when shared. */
  icalUid: string | null;
  title: string;
  description: string | null;
  /** ISO 8601. */
  startsAt: Date;
  /** ISO 8601 — null for events without an explicit end. */
  endsAt: Date | null;
  /** Tenant time zone label (`'America/New_York'`). */
  timeZone: string | null;
  /**
   * Conferencing URL extracted from the event body — Zoom / Teams /
   * Meet / external. Null when the event has no detectable link.
   */
  conferenceUrl: string | null;
  /**
   * Provider source — drives downstream bot routing. Pulled from the
   * Nylas account's underlying calendar service.
   */
  sourceKind: CalendarSourceKind;
  /** Attendee email list — used for the F5-CRM deal-mapping flow. */
  attendees: ReadonlyArray<{ email: string; name: string | null }>;
}

export interface ListUpcomingInput {
  /** Tenant id — drives logging context only. */
  tenantId: string;
  /** Account id from the Nylas connection. */
  nylasAccountId: string;
  /** Inclusive lower bound. */
  since: Date;
  /** Exclusive upper bound. */
  until: Date;
  /** Cap result count. */
  limit?: number;
}

export interface CalendarProvider {
  kind: CalendarProviderKind;
  listUpcoming(input: ListUpcomingInput): Promise<CalendarEvent[]>;
}
