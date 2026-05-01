import { describe, expect, it } from 'vitest';

import { resolveDeepLink } from './use-deep-link-resolver.js';

const MEETING_UUID = '00000000-0000-0000-0000-000000000abc';
const ACTION_UUID = '00000000-0000-0000-0000-000000000def';
const TOKEN_HASH = 'a'.repeat(64);
const baseHost = 'aisecretary.app';

describe('resolveDeepLink', () => {
  it('parses a meeting deep link', () => {
    const r = resolveDeepLink({
      url: `https://acme.us.${baseHost}/meetings/${MEETING_UUID}`,
      baseHost,
    });
    expect(r).toEqual({ kind: 'meeting', meetingId: MEETING_UUID });
  });

  it('parses a meeting-citation deep link with turn + t params', () => {
    const r = resolveDeepLink({
      url: `https://acme.us.${baseHost}/meetings/${MEETING_UUID}?turn=t-15&t=120000`,
      baseHost,
    });
    expect(r).toEqual({
      kind: 'meeting-citation',
      meetingId: MEETING_UUID,
      turnId: 't-15',
      spanStartMs: 120_000,
    });
  });

  it('parses an action-item deep link', () => {
    const r = resolveDeepLink({
      url: `https://acme.us.${baseHost}/actions/${ACTION_UUID}`,
      baseHost,
    });
    expect(r).toEqual({ kind: 'action-item', actionItemId: ACTION_UUID });
  });

  it('parses a share-token deep link', () => {
    const r = resolveDeepLink({
      url: `https://${baseHost}/share/${TOKEN_HASH}`,
      baseHost,
    });
    expect(r).toEqual({ kind: 'share-token', tokenHash: TOKEN_HASH });
  });

  it('parses a consent page link', () => {
    const r = resolveDeepLink({ url: `https://${baseHost}/consent`, baseHost });
    expect(r.kind).toBe('consent-page');
  });

  it('rejects URLs from foreign hosts', () => {
    const r = resolveDeepLink({
      url: 'https://evil.example.com/meetings/something',
      baseHost,
    });
    expect(r.kind).toBe('unknown');
  });

  it('rejects malformed URLs', () => {
    const r = resolveDeepLink({ url: 'not a url', baseHost });
    expect(r.kind).toBe('unknown');
  });

  it('rejects a meeting link with a malformed UUID', () => {
    const r = resolveDeepLink({
      url: `https://${baseHost}/meetings/not-a-uuid`,
      baseHost,
    });
    expect(r.kind).toBe('unknown');
  });

  it('falls back to plain meeting target when t param is non-numeric', () => {
    const r = resolveDeepLink({
      url: `https://${baseHost}/meetings/${MEETING_UUID}?turn=t-1&t=abc`,
      baseHost,
    });
    expect(r.kind).toBe('meeting');
  });

  it('rejects a share link with a malformed token hash', () => {
    const r = resolveDeepLink({
      url: `https://${baseHost}/share/notahash`,
      baseHost,
    });
    expect(r.kind).toBe('unknown');
  });
});
