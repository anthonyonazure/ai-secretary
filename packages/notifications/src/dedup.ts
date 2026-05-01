import { createHash } from 'node:crypto';
import type { NotificationKind, NotificationPayload, NotificationRecipient } from './types.js';

/** Default dedup window per arch-addendums § 5: 5 minutes. */
export const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Hash the rendered payload so dedup is content-aware *and* stable
 * across in-process retries. The hash also lands in the `notifications`
 * table for postmortem inspection (per AC: `payload_hash` column).
 */
export const hashPayload = (payload: NotificationPayload): string => {
  // Stable JSON: object-keys sorted at top level. Templates' context
  // objects are flat-ish in practice; for nested keys we accept the
  // fact that hash equality requires same key order at deeper levels.
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(json).digest('hex');
};

/**
 * Resolve the recipient identifier — the *thing* we're deduping on.
 * Push: userId (cross-device; if any device gets the message we don't
 * want a second nag from the next).
 * Email: lowercased email address.
 */
export const recipientKey = (recipient: NotificationRecipient): string => {
  if (recipient.channel === 'push') return recipient.userId;
  return recipient.email.trim().toLowerCase();
};

/**
 * Compute the dedup key. Caller-supplied `dedupKey` (e.g. `recordingId`
 * for capture-at-risk) takes precedence; otherwise we derive a stable
 * hash from `(kind, payloadHash)` so the same content sent twice in
 * five minutes is suppressed.
 */
export const computeDedupKey = (args: {
  kind: NotificationKind;
  payloadHash: string;
  callerSupplied?: string;
}): string => {
  if (args.callerSupplied && args.callerSupplied.length > 0) {
    return args.callerSupplied;
  }
  return createHash('sha256').update(`${args.kind}|${args.payloadHash}`).digest('hex');
};
