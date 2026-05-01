/**
 * Bot session FSM. Pure: takes the previous session shape + an event,
 * returns the next session shape. The DB write is the caller's job.
 *
 * Valid transitions:
 *
 *   provisioning → joined        (provider join() resolved)
 *   provisioning → failed        (provider join() rejected)
 *   joined        → ended        (provider leave() resolved)
 *   joined        → failed       (connection lost / abort)
 *
 * `ended` and `failed` are terminal — any further event throws
 * `BotStateTransitionError`.
 */

import { BotStateTransitionError } from './errors.js';
import type { BotSession, BotSessionStatus } from './types.js';

export type BotSessionEvent =
  | { kind: 'joined'; at: Date }
  | { kind: 'ended'; at: Date }
  | { kind: 'failed'; at: Date; reason: string };

const TERMINAL: ReadonlySet<BotSessionStatus> = new Set(['ended', 'failed']);

const VALID_TRANSITIONS: Readonly<Record<BotSessionStatus, ReadonlySet<BotSessionStatus>>> = {
  provisioning: new Set<BotSessionStatus>(['joined', 'failed']),
  joined: new Set<BotSessionStatus>(['ended', 'failed']),
  ended: new Set<BotSessionStatus>(),
  failed: new Set<BotSessionStatus>(),
};

export const isTerminal = (status: BotSessionStatus): boolean => TERMINAL.has(status);

export const canTransition = (from: BotSessionStatus, to: BotSessionStatus): boolean =>
  VALID_TRANSITIONS[from].has(to);

const eventToStatus = (event: BotSessionEvent): BotSessionStatus => {
  switch (event.kind) {
    case 'joined':
      return 'joined';
    case 'ended':
      return 'ended';
    case 'failed':
      return 'failed';
  }
};

/**
 * Apply an event to a session. Returns a new session object; never
 * mutates the input. Throws `BotStateTransitionError` on invalid
 * transition.
 */
export const applyEvent = (session: BotSession, event: BotSessionEvent): BotSession => {
  const next = eventToStatus(event);
  if (!canTransition(session.status, next)) {
    throw new BotStateTransitionError(session.status, next);
  }

  switch (event.kind) {
    case 'joined':
      return {
        ...session,
        status: 'joined',
        joinedAt: event.at,
        updatedAt: event.at,
      };
    case 'ended':
      return {
        ...session,
        status: 'ended',
        endedAt: event.at,
        updatedAt: event.at,
      };
    case 'failed':
      return {
        ...session,
        status: 'failed',
        endedAt: event.at,
        failureReason: event.reason,
        updatedAt: event.at,
      };
  }
};

/**
 * Audit-action mapping. Mirrors the union the API package needs to
 * extend in `apps/api/src/lib/audit-types.ts`.
 */
export const AUDIT_ACTION_BY_EVENT = {
  joined: 'bot.session.joined',
  ended: 'bot.session.ended',
  failed: 'bot.session.failed',
} as const;

export type BotAuditAction =
  | 'bot.session.provisioned'
  | (typeof AUDIT_ACTION_BY_EVENT)[keyof typeof AUDIT_ACTION_BY_EVENT];

export const BOT_AUDIT_ACTIONS: readonly BotAuditAction[] = [
  'bot.session.provisioned',
  'bot.session.joined',
  'bot.session.ended',
  'bot.session.failed',
];
