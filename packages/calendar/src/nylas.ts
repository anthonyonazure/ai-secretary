/**
 * `NylasCalendarProvider` — Story 10.1.
 *
 * Wraps the Nylas v3 events API. We talk to it via plain `fetch`
 * (matches the `packages/transcription` faster-whisper pattern) so
 * the Nylas SDK isn't a hard dependency. Credentials are passed at
 * construction time; production wires them from `tenant_integrations`
 * (Story 12.2 follow-up).
 *
 * Provider-isolation discipline: this is the ONLY file in the
 * codebase that knows about the Nylas wire format. Callers consume
 * the `CalendarProvider` interface and never see Nylas-specific
 * shapes leak.
 */

import type {
  CalendarEvent,
  CalendarProvider,
  CalendarProviderKind,
  CalendarSourceKind,
  ListUpcomingInput,
} from './types.js';

export interface NylasCalendarProviderConfig {
  /** Nylas v3 API base — `'https://api.us.nylas.com'` for US, `'https://api.eu.nylas.com'` for EU. */
  apiBase: string;
  /** Tenant-scoped API key for the Nylas application. */
  apiKey: string;
  /** Per-call timeout in ms. Default 15s. */
  timeoutMs?: number;
}

/** Errors thrown by the calendar provider for the worker to retry on. */
export class NylasCalendarError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'NylasCalendarError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

const PROVIDER_TO_SOURCE: Record<string, CalendarSourceKind> = {
  google: 'google',
  microsoft: 'microsoft',
  exchange: 'exchange',
  icloud: 'icloud',
  // Nylas sometimes returns `'gmail'` or `'office365'` — collapse them.
  gmail: 'google',
  office365: 'microsoft',
};

const CONFERENCE_URL_RE =
  /https?:\/\/[^\s<>"]*?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com)[^\s<>"]*/i;

const detectConferenceUrl = (description: string | null): string | null => {
  if (!description) return null;
  const match = description.match(CONFERENCE_URL_RE);
  return match?.[0] ?? null;
};

interface NylasEventsResponse {
  data?: Array<{
    id: string;
    ical_uid?: string | null;
    title?: string | null;
    description?: string | null;
    when: { start_time?: number; end_time?: number; start_timezone?: string | null };
    participants?: Array<{ email: string; name?: string | null }>;
    conferencing?: { details?: { url?: string | null } };
    /** Nylas surfaces the underlying provider per account. */
    provider?: string;
  }>;
}

export class NylasCalendarProvider implements CalendarProvider {
  public readonly kind: CalendarProviderKind = 'nylas';
  private readonly timeoutMs: number;

  constructor(private readonly config: NylasCalendarProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async listUpcoming(input: ListUpcomingInput): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      // Nylas v3 takes Unix seconds for the time window.
      start: String(Math.floor(input.since.getTime() / 1000)),
      end: String(Math.floor(input.until.getTime() / 1000)),
      limit: String(input.limit ?? 50),
      expand_recurring: 'true',
    });
    const url = `${this.config.apiBase}/v3/grants/${encodeURIComponent(
      input.nylasAccountId,
    )}/events?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await safeText(res);
        throw new NylasCalendarError(`nylas: upstream returned ${res.status}: ${body}`, res.status);
      }
      const json = (await res.json()) as NylasEventsResponse;
      const events = json.data ?? [];
      return events
        .filter((e) => e.when.start_time !== undefined)
        .map((e): CalendarEvent => {
          const startsAt = new Date((e.when.start_time as number) * 1000);
          const endsAt =
            typeof e.when.end_time === 'number' ? new Date(e.when.end_time * 1000) : null;
          const description = e.description ?? null;
          const conferenceUrl = e.conferencing?.details?.url ?? detectConferenceUrl(description);
          const sourceKind: CalendarSourceKind = PROVIDER_TO_SOURCE[e.provider ?? ''] ?? 'google';
          return {
            id: e.id,
            icalUid: e.ical_uid ?? null,
            title: e.title ?? '(no title)',
            description,
            startsAt,
            endsAt,
            timeZone: e.when.start_timezone ?? null,
            conferenceUrl,
            sourceKind,
            attendees: (e.participants ?? []).map((p) => ({
              email: p.email,
              name: p.name ?? null,
            })),
          };
        });
    } finally {
      clearTimeout(timer);
    }
  }
}

const safeText = async (res: Response): Promise<string> => {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
};
