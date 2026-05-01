import { describe, expect, it } from 'vitest';

import { type CoachingDraft, deriveCoachingFeedbackState } from './use-coaching-feedback-state.js';

const draft = (overrides: Partial<CoachingDraft> = {}): CoachingDraft => ({
  id: 'd-1',
  authorUserId: 'mgr-1',
  targetUserId: 'rep-1',
  meetingId: 'm-1',
  text: 'Strong open — try one open-ended question after discovery.',
  span: { spanStartMs: 30_000, spanEndMs: 40_000 },
  privateToManager: false,
  ...overrides,
});

describe('deriveCoachingFeedbackState', () => {
  it('allows a manager to post feedback to a rep', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft(),
      isManager: true,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.canPost).toBe(true);
    expect(r.spanLabel).toBe('0:30–0:40');
    expect(r.blockers).toHaveLength(0);
  });

  it('blocks non-managers from posting', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft(),
      isManager: false,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.canPost).toBe(false);
    expect(r.blockers).toContain('not-manager');
  });

  it('blocks self-coaching even when the user is a manager', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft({ authorUserId: 'rep-1' }),
      isManager: true,
      isOwner: true,
      recordingDurationMs: 60_000,
    });
    expect(r.canPost).toBe(false);
    expect(r.blockers).toContain('self-coaching');
  });

  it('blocks an empty or whitespace-only feedback body', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft({ text: '   ' }),
      isManager: true,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.blockers).toContain('empty-text');
  });

  it('flags an inverted span', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft({ span: { spanStartMs: 50_000, spanEndMs: 30_000 } }),
      isManager: true,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.blockers).toContain('span-inverted');
  });

  it('flags a span past the recording end', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft({ span: { spanStartMs: 30_000, spanEndMs: 90_000 } }),
      isManager: true,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.blockers).toContain('span-out-of-bounds');
  });

  it('passes when no span is set (whole-meeting feedback)', () => {
    const r = deriveCoachingFeedbackState({
      draft: draft({ span: null }),
      isManager: true,
      isOwner: false,
      recordingDurationMs: 60_000,
    });
    expect(r.canPost).toBe(true);
    expect(r.spanLabel).toBeNull();
  });
});
