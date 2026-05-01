import { describe, expect, it } from 'vitest';

import { deriveUndoCountdown } from './use-undo-countdown.js';

describe('deriveUndoCountdown', () => {
  it('shows the banner with seconds-remaining inside the cooldown window', () => {
    const now = 1_700_000_000_000;
    const r = deriveUndoCountdown({
      action: 'mark-done',
      performedAtMs: now - 2_500,
      now,
    });
    expect(r.visible).toBe(true);
    expect(r.secondsRemaining).toBe(5);
    expect(r.copy).toMatch(/5s/);
  });

  it('hides the banner once the cooldown is over', () => {
    const now = 1_700_000_000_000;
    const r = deriveUndoCountdown({
      action: 'mark-done',
      performedAtMs: now - 10_000,
      now,
    });
    expect(r.visible).toBe(false);
    expect(r.secondsRemaining).toBe(0);
  });

  it('flags shouldCommit in the brief window just after expiry', () => {
    const now = 1_700_000_000_000;
    const r = deriveUndoCountdown({
      action: 'archive-meeting',
      performedAtMs: now - 7_500,
      now,
    });
    expect(r.shouldCommit).toBe(true);
  });

  it('does not flag shouldCommit far past expiry', () => {
    const now = 1_700_000_000_000;
    const r = deriveUndoCountdown({
      action: 'archive-meeting',
      performedAtMs: now - 60_000,
      now,
    });
    expect(r.shouldCommit).toBe(false);
  });

  it('honors a custom cooldown', () => {
    const now = 1_700_000_000_000;
    const r = deriveUndoCountdown({
      action: 'snooze-notification',
      performedAtMs: now - 1_000,
      cooldownMs: 30_000,
      now,
    });
    expect(r.secondsRemaining).toBe(29);
  });

  it('uses the right copy per action', () => {
    const now = 1_700_000_000_000;
    expect(
      deriveUndoCountdown({ action: 'revoke-share', performedAtMs: now - 1_000, now }).copy,
    ).toMatch(/Share revoked/);
    expect(
      deriveUndoCountdown({
        action: 'delete-action-item',
        performedAtMs: now - 1_000,
        now,
      }).copy,
    ).toMatch(/deleted/);
  });
});
