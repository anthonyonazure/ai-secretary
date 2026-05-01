import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockCalendarProvider } from './mock.js';
import { NylasCalendarError, NylasCalendarProvider } from './nylas.js';
import type { CalendarEvent } from './types.js';

const sampleEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt-1',
  icalUid: 'uid-1',
  title: 'Test meeting',
  description: null,
  startsAt: new Date('2026-04-30T14:00:00Z'),
  endsAt: new Date('2026-04-30T14:30:00Z'),
  timeZone: 'America/New_York',
  conferenceUrl: null,
  sourceKind: 'google',
  attendees: [{ email: 'alice@example.com', name: 'Alice' }],
  ...overrides,
});

describe('MockCalendarProvider', () => {
  it('filters by [since, until)', async () => {
    const provider = new MockCalendarProvider([
      sampleEvent({ id: 'a', startsAt: new Date('2026-04-30T08:00:00Z') }),
      sampleEvent({ id: 'b', startsAt: new Date('2026-04-30T14:00:00Z') }),
      sampleEvent({ id: 'c', startsAt: new Date('2026-05-01T09:00:00Z') }),
    ]);
    const result = await provider.listUpcoming({
      tenantId: 't',
      nylasAccountId: 'n',
      since: new Date('2026-04-30T10:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
    });
    expect(result.map((e) => e.id)).toEqual(['b']);
  });

  it('honors the `limit` cap', async () => {
    const provider = new MockCalendarProvider([
      sampleEvent({ id: 'a', startsAt: new Date('2026-04-30T08:00:00Z') }),
      sampleEvent({ id: 'b', startsAt: new Date('2026-04-30T09:00:00Z') }),
      sampleEvent({ id: 'c', startsAt: new Date('2026-04-30T10:00:00Z') }),
    ]);
    const result = await provider.listUpcoming({
      tenantId: 't',
      nylasAccountId: 'n',
      since: new Date('2026-04-30T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });
});

describe('NylasCalendarProvider', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('parses the Nylas v3 events response into CalendarEvent[]', async () => {
    const fetchSpy = vi.fn(async (url) => {
      expect(String(url)).toContain('/v3/grants/');
      expect(String(url)).toContain('start=');
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'evt-1',
              ical_uid: 'uid-1',
              title: 'Quarterly review',
              description: 'See https://zoom.us/j/123456789 for the link.',
              when: { start_time: 1714478400, end_time: 1714482000 },
              participants: [{ email: 'alice@example.com', name: 'Alice' }],
              provider: 'gmail',
            },
          ],
        }),
        { status: 200 },
      );
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new NylasCalendarProvider({
      apiBase: 'https://api.us.nylas.com',
      apiKey: 'k',
    });
    const result = await provider.listUpcoming({
      tenantId: 't',
      nylasAccountId: 'grant-123',
      since: new Date('2026-04-30T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Quarterly review');
    expect(result[0]?.sourceKind).toBe('google');
    expect(result[0]?.conferenceUrl).toContain('zoom.us');
  });

  it('throws a NylasCalendarError on a non-2xx response', async () => {
    globalThis.fetch = (async () =>
      new Response('upstream sad', { status: 503 })) as unknown as typeof fetch;
    const provider = new NylasCalendarProvider({
      apiBase: 'https://api.us.nylas.com',
      apiKey: 'k',
    });
    await expect(
      provider.listUpcoming({
        tenantId: 't',
        nylasAccountId: 'g',
        since: new Date(),
        until: new Date(),
      }),
    ).rejects.toBeInstanceOf(NylasCalendarError);
  });

  it('extracts a Google Meet conference URL from the description', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'evt-2',
              when: { start_time: 1714478400 },
              description: 'Join: https://meet.google.com/abc-defg-hij',
              provider: 'google',
              participants: [],
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const provider = new NylasCalendarProvider({
      apiBase: 'https://api.us.nylas.com',
      apiKey: 'k',
    });
    const result = await provider.listUpcoming({
      tenantId: 't',
      nylasAccountId: 'g',
      since: new Date('2026-04-30T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
    });
    expect(result[0]?.conferenceUrl).toContain('meet.google.com');
  });
});
