import { describe, expect, it } from 'vitest';
import { DEDUP_WINDOW_MS, computeDedupKey, hashPayload, recipientKey } from './dedup.js';
import type { NotificationPayload, NotificationRecipient } from './types.js';

describe('hashPayload', () => {
  it('returns a stable sha256 for identical payloads', () => {
    const payload: NotificationPayload = {
      channel: 'push',
      title: 'hello',
      body: 'world',
      data: { meetingId: 'abc' },
    };
    expect(hashPayload(payload)).toEqual(hashPayload(payload));
  });

  it('produces different hashes for different bodies', () => {
    const a: NotificationPayload = { channel: 'push', title: 't', body: 'a' };
    const b: NotificationPayload = { channel: 'push', title: 't', body: 'b' };
    expect(hashPayload(a)).not.toEqual(hashPayload(b));
  });

  it('produces different hashes for different channels', () => {
    const push: NotificationPayload = { channel: 'push', title: 't', body: 'b' };
    const email: NotificationPayload = { channel: 'email', context: { x: 1 } };
    expect(hashPayload(push)).not.toEqual(hashPayload(email));
  });
});

describe('recipientKey', () => {
  it('returns userId for push recipients', () => {
    const r: NotificationRecipient = {
      channel: 'push',
      userId: 'user-1',
      pushTokens: ['ExponentPushToken[abc]'],
    };
    expect(recipientKey(r)).toBe('user-1');
  });

  it('lowercases + trims email recipients', () => {
    const r: NotificationRecipient = {
      channel: 'email',
      email: '  Foo@Example.COM  ',
    };
    expect(recipientKey(r)).toBe('foo@example.com');
  });
});

describe('computeDedupKey', () => {
  it('uses caller-supplied key when present', () => {
    const key = computeDedupKey({
      kind: 'capture-at-risk',
      payloadHash: 'abc',
      callerSupplied: 'recording-123',
    });
    expect(key).toBe('recording-123');
  });

  it('derives a stable hash from kind + payloadHash when caller key absent', () => {
    const a = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h' });
    const b = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when payload hash changes', () => {
    const a = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h1' });
    const b = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h2' });
    expect(a).not.toBe(b);
  });

  it('changes when kind changes', () => {
    const a = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h' });
    const b = computeDedupKey({ kind: 'bot-join-failed', payloadHash: 'h' });
    expect(a).not.toBe(b);
  });

  it('treats empty string as missing for caller-supplied', () => {
    const a = computeDedupKey({
      kind: 'capture-at-risk',
      payloadHash: 'h',
      callerSupplied: '',
    });
    const b = computeDedupKey({ kind: 'capture-at-risk', payloadHash: 'h' });
    expect(a).toBe(b);
  });
});

describe('DEDUP_WINDOW_MS', () => {
  it('is 5 minutes per arch-addendums § 5', () => {
    expect(DEDUP_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});
