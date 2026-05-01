import { describe, expect, it } from 'vitest';

import {
  buildCitationDeepLink,
  isSameCitation,
  parseCitationDeepLink,
} from './citation-deeplink.js';

const MEETING_UUID = '00000000-0000-0000-0000-000000000abc';

describe('buildCitationDeepLink', () => {
  it('builds a meeting-only URL when turn + t are absent', () => {
    expect(
      buildCitationDeepLink({
        meetingId: MEETING_UUID,
        turnId: null,
        spanStartMs: null,
        host: 'aisecretary.app',
      }),
    ).toBe(`https://aisecretary.app/meetings/${MEETING_UUID}`);
  });

  it('attaches turn + t params when present', () => {
    const url = buildCitationDeepLink({
      meetingId: MEETING_UUID,
      turnId: 't-15',
      spanStartMs: 120_000,
      host: 'acme.us.aisecretary.app',
    });
    expect(url).toContain('turn=t-15');
    expect(url).toContain('t=120000');
  });

  it('floors fractional ms to integer', () => {
    const url = buildCitationDeepLink({
      meetingId: MEETING_UUID,
      turnId: null,
      spanStartMs: 1234.6,
      host: 'aisecretary.app',
    });
    expect(url).toContain('t=1234');
  });

  it('clamps negative ms to 0', () => {
    const url = buildCitationDeepLink({
      meetingId: MEETING_UUID,
      turnId: null,
      spanStartMs: -100,
      host: 'aisecretary.app',
    });
    expect(url).toContain('t=0');
  });

  it('honors a custom scheme for local dev', () => {
    const url = buildCitationDeepLink({
      meetingId: MEETING_UUID,
      turnId: null,
      spanStartMs: null,
      host: 'localhost:5173',
      scheme: 'http',
    });
    expect(url.startsWith('http://')).toBe(true);
  });
});

describe('parseCitationDeepLink', () => {
  it('returns the meeting + turn + t when present', () => {
    const r = parseCitationDeepLink(
      `https://aisecretary.app/meetings/${MEETING_UUID}?turn=t-15&t=180000`,
    );
    expect(r).toEqual({
      meetingId: MEETING_UUID,
      turnId: 't-15',
      spanStartMs: 180_000,
    });
  });

  it('returns null on a malformed URL', () => {
    expect(parseCitationDeepLink('not a url')).toBeNull();
  });

  it('returns null on a URL with a non-UUID meeting id', () => {
    expect(parseCitationDeepLink('https://aisecretary.app/meetings/not-a-uuid')).toBeNull();
  });

  it('returns null on a non-meeting path', () => {
    expect(parseCitationDeepLink(`https://aisecretary.app/recordings/${MEETING_UUID}`)).toBeNull();
  });

  it('returns null spanStartMs when t is missing', () => {
    const r = parseCitationDeepLink(`https://aisecretary.app/meetings/${MEETING_UUID}?turn=t-1`);
    expect(r?.spanStartMs).toBeNull();
  });
});

describe('isSameCitation', () => {
  it('treats two URLs with matching meeting + turn as the same citation', () => {
    expect(
      isSameCitation(
        `https://aisecretary.app/meetings/${MEETING_UUID}?turn=t-1&t=1000`,
        `https://acme.us.aisecretary.app/meetings/${MEETING_UUID}?turn=t-1&t=2000`,
      ),
    ).toBe(true);
  });

  it('treats different turns as different citations', () => {
    expect(
      isSameCitation(
        `https://aisecretary.app/meetings/${MEETING_UUID}?turn=t-1`,
        `https://aisecretary.app/meetings/${MEETING_UUID}?turn=t-2`,
      ),
    ).toBe(false);
  });

  it('returns false when either URL is malformed', () => {
    expect(isSameCitation('a', 'b')).toBe(false);
  });
});
