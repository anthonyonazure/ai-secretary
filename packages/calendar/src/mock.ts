import type {
  CalendarEvent,
  CalendarProvider,
  CalendarProviderKind,
  ListUpcomingInput,
} from './types.js';

/**
 * `MockCalendarProvider` — deterministic test stub.
 *
 * Constructed with a fixed event list; `listUpcoming` filters by the
 * `[since, until)` window. Tests exercise the worker scheduler logic
 * without booting the Nylas SDK or hitting real calendars.
 */
export class MockCalendarProvider implements CalendarProvider {
  public readonly kind: CalendarProviderKind = 'mock';
  constructor(public readonly events: CalendarEvent[] = []) {}

  async listUpcoming(input: ListUpcomingInput): Promise<CalendarEvent[]> {
    const since = input.since.getTime();
    const until = input.until.getTime();
    const matched = this.events.filter((e) => {
      const t = e.startsAt.getTime();
      return t >= since && t < until;
    });
    if (typeof input.limit === 'number') return matched.slice(0, input.limit);
    return matched;
  }
}
