import { describe, expect, it } from 'vitest';

import { BotStateTransitionError } from './errors.js';
import {
  AUDIT_ACTION_BY_EVENT,
  BOT_AUDIT_ACTIONS,
  applyEvent,
  canTransition,
  isTerminal,
} from './fsm.js';
import type { BotSession } from './types.js';

const baseSession: BotSession = {
  sessionId: 'sess-1',
  tenantId: 'tenant-1',
  ownerUserId: 'user-1',
  meetingId: 'meeting-1',
  source: 'zoom_bot',
  region: 'us',
  externalMeetingId: '999-000-111',
  status: 'provisioning',
  joinedAt: null,
  endedAt: null,
  failureReason: null,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
};

describe('bot session FSM', () => {
  describe('canTransition', () => {
    it('permits provisioning → joined', () => {
      expect(canTransition('provisioning', 'joined')).toBe(true);
    });

    it('permits provisioning → failed', () => {
      expect(canTransition('provisioning', 'failed')).toBe(true);
    });

    it('permits joined → ended', () => {
      expect(canTransition('joined', 'ended')).toBe(true);
    });

    it('permits joined → failed', () => {
      expect(canTransition('joined', 'failed')).toBe(true);
    });

    it('rejects provisioning → ended (must go through joined)', () => {
      expect(canTransition('provisioning', 'ended')).toBe(false);
    });

    it('rejects ended → anything (terminal)', () => {
      expect(canTransition('ended', 'joined')).toBe(false);
      expect(canTransition('ended', 'failed')).toBe(false);
      expect(canTransition('ended', 'ended')).toBe(false);
    });

    it('rejects failed → anything (terminal)', () => {
      expect(canTransition('failed', 'joined')).toBe(false);
      expect(canTransition('failed', 'ended')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it.each([
      ['provisioning' as const, false],
      ['joined' as const, false],
      ['ended' as const, true],
      ['failed' as const, true],
    ])('isTerminal(%s) === %s', (status, expected) => {
      expect(isTerminal(status)).toBe(expected);
    });
  });

  describe('applyEvent — provisioning → joined', () => {
    it('marks the session joined, stamps joinedAt, leaves endedAt null', () => {
      const at = new Date('2026-05-01T00:01:00Z');
      const next = applyEvent(baseSession, { kind: 'joined', at });
      expect(next.status).toBe('joined');
      expect(next.joinedAt).toEqual(at);
      expect(next.endedAt).toBeNull();
      expect(next.updatedAt).toEqual(at);
      expect(next).not.toBe(baseSession);
    });
  });

  describe('applyEvent — joined → ended', () => {
    it('stamps endedAt and clears failureReason', () => {
      const joined = applyEvent(baseSession, {
        kind: 'joined',
        at: new Date('2026-05-01T00:01:00Z'),
      });
      const at = new Date('2026-05-01T00:30:00Z');
      const next = applyEvent(joined, { kind: 'ended', at });
      expect(next.status).toBe('ended');
      expect(next.endedAt).toEqual(at);
      expect(next.failureReason).toBeNull();
    });
  });

  describe('applyEvent — provisioning → failed', () => {
    it('records the failure reason and stamps endedAt', () => {
      const at = new Date('2026-05-01T00:00:30Z');
      const next = applyEvent(baseSession, {
        kind: 'failed',
        at,
        reason: 'host-denied-entry',
      });
      expect(next.status).toBe('failed');
      expect(next.failureReason).toBe('host-denied-entry');
      expect(next.endedAt).toEqual(at);
      expect(next.joinedAt).toBeNull();
    });
  });

  describe('applyEvent — joined → failed', () => {
    it('preserves joinedAt and records the failure reason', () => {
      const joinedAt = new Date('2026-05-01T00:01:00Z');
      const joined = applyEvent(baseSession, { kind: 'joined', at: joinedAt });
      const failedAt = new Date('2026-05-01T00:05:00Z');
      const next = applyEvent(joined, {
        kind: 'failed',
        at: failedAt,
        reason: 'connection-lost',
      });
      expect(next.status).toBe('failed');
      expect(next.joinedAt).toEqual(joinedAt);
      expect(next.endedAt).toEqual(failedAt);
      expect(next.failureReason).toBe('connection-lost');
    });
  });

  describe('applyEvent — invalid transitions', () => {
    it('throws when applying joined to an already-failed session', () => {
      const failed = applyEvent(baseSession, {
        kind: 'failed',
        at: new Date(),
        reason: 'whatever',
      });
      expect(() => applyEvent(failed, { kind: 'joined', at: new Date() })).toThrow(
        BotStateTransitionError,
      );
    });

    it('throws when applying ended to a provisioning session (must join first)', () => {
      expect(() => applyEvent(baseSession, { kind: 'ended', at: new Date() })).toThrow(
        BotStateTransitionError,
      );
    });

    it('throws when applying any event to an ended session', () => {
      const joined = applyEvent(baseSession, { kind: 'joined', at: new Date() });
      const ended = applyEvent(joined, { kind: 'ended', at: new Date() });
      expect(() => applyEvent(ended, { kind: 'failed', at: new Date(), reason: 'x' })).toThrow(
        BotStateTransitionError,
      );
    });

    it('error carries the from + to states', () => {
      try {
        applyEvent(baseSession, { kind: 'ended', at: new Date() });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotStateTransitionError);
        const e = err as BotStateTransitionError;
        expect(e.from).toBe('provisioning');
        expect(e.to).toBe('ended');
      }
    });
  });

  describe('audit-action mapping', () => {
    it('exposes a stable mapping from event kind to audit action', () => {
      expect(AUDIT_ACTION_BY_EVENT.joined).toBe('bot.session.joined');
      expect(AUDIT_ACTION_BY_EVENT.ended).toBe('bot.session.ended');
      expect(AUDIT_ACTION_BY_EVENT.failed).toBe('bot.session.failed');
    });

    it('lists all four audit actions including the create-time provisioned action', () => {
      expect(BOT_AUDIT_ACTIONS).toEqual([
        'bot.session.provisioned',
        'bot.session.joined',
        'bot.session.ended',
        'bot.session.failed',
      ]);
    });
  });
});
