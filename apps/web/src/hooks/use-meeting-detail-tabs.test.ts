import { describe, expect, it } from 'vitest';

import { deriveMeetingDetailTabs } from './use-meeting-detail-tabs';

describe('deriveMeetingDetailTabs (web)', () => {
  it('returns just the receipt tab for a brand-new meeting', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: false,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).toEqual(['receipt']);
    expect(r.defaultTab).toBe('receipt');
    expect(r.badges.actions).toBeNull();
  });

  it('reveals transcript and actions tabs as data lands', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: false,
      actionItemCount: 3,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).toEqual(['receipt', 'transcript', 'actions']);
    expect(r.badges.actions).toBe(3);
  });

  it('reveals analysis + actions when analysis lands without explicit action items', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).toEqual(['receipt', 'transcript', 'analysis', 'actions']);
    expect(r.badges.actions).toBeNull();
  });

  it('shows the audit tab only for admins', () => {
    const noAudit = deriveMeetingDetailTabs({
      hasTranscript: false,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(noAudit.visibleTabs).not.toContain('audit');

    const withAudit = deriveMeetingDetailTabs({
      hasTranscript: false,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: true,
    });
    expect(withAudit.visibleTabs).toContain('audit');
  });

  it('shows shares tab only when shares > 0', () => {
    const noShares = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(noShares.visibleTabs).not.toContain('shares');
    expect(noShares.badges.shares).toBeNull();

    const withShares = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 2,
      isAdmin: false,
    });
    expect(withShares.visibleTabs).toContain('shares');
    expect(withShares.badges.shares).toBe(2);
  });

  it('honors a preferredTab when it is in the visible set', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: false,
      actionItemCount: 1,
      shareCount: 0,
      isAdmin: false,
      preferredTab: 'transcript',
    });
    expect(r.defaultTab).toBe('transcript');
  });

  it('falls back to receipt when preferredTab is not in the visible set', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: false,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
      preferredTab: 'audit',
    });
    expect(r.defaultTab).toBe('receipt');
  });
});
