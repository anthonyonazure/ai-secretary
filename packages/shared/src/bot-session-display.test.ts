import { describe, expect, it } from 'vitest';

import {
  deriveBotSessionDisplay,
  formatBotSessionTitle,
  isBotSessionActive,
  pickPrimaryBotSession,
} from './bot-session-display.js';

describe('deriveBotSessionDisplay', () => {
  it('maps each wire status to a stable label + tone', () => {
    expect(deriveBotSessionDisplay('provisioning')).toEqual({
      label: 'Joining…',
      tone: 'progress',
    });
    expect(deriveBotSessionDisplay('joined')).toEqual({ label: 'Live', tone: 'live' });
    expect(deriveBotSessionDisplay('ended')).toEqual({ label: 'Ended', tone: 'success' });
    expect(deriveBotSessionDisplay('failed')).toEqual({
      label: "Bot couldn't join",
      tone: 'error',
    });
  });
});

describe('formatBotSessionTitle', () => {
  it('combines source + status into a single sentence', () => {
    expect(formatBotSessionTitle('zoom_bot', 'joined')).toBe('Zoom bot · Live');
    expect(formatBotSessionTitle('teams_bot', 'provisioning')).toBe('Teams bot · Joining…');
  });
});

describe('isBotSessionActive', () => {
  it('flags provisioning + joined as active', () => {
    expect(isBotSessionActive('provisioning')).toBe(true);
    expect(isBotSessionActive('joined')).toBe(true);
    expect(isBotSessionActive('ended')).toBe(false);
    expect(isBotSessionActive('failed')).toBe(false);
  });
});

describe('pickPrimaryBotSession', () => {
  it('returns null when the list is empty', () => {
    expect(pickPrimaryBotSession([])).toBeNull();
  });

  it('prefers an active session over a recently-ended one', () => {
    const active = { status: 'provisioning' as const, createdAt: '2026-05-01T10:00:00.000Z' };
    const ended = { status: 'ended' as const, createdAt: '2026-05-01T11:00:00.000Z' };
    expect(pickPrimaryBotSession([ended, active])).toBe(active);
  });

  it('breaks ties on createdAt (most recent first)', () => {
    const older = { status: 'failed' as const, createdAt: '2026-05-01T08:00:00.000Z' };
    const newer = { status: 'failed' as const, createdAt: '2026-05-01T09:00:00.000Z' };
    expect(pickPrimaryBotSession([older, newer])).toBe(newer);
  });
});
