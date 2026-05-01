import { describe, expect, it } from 'vitest';

import { deriveMeetingDetailTabs } from './use-meeting-detail-tabs.js';

describe('deriveMeetingDetailTabs', () => {
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
  });

  it('reveals transcript and analysis tabs as data lands', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).toContain('transcript');
    expect(r.visibleTabs).toContain('analysis');
    expect(r.visibleTabs).toContain('actions');
  });

  it('shows action-item count as a badge when items exist', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 4,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.badges.actions).toBe(4);
  });

  it('hides the audit tab from non-admins', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).not.toContain('audit');
  });

  it('shows the audit tab for admins', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: true,
    });
    expect(r.visibleTabs).toContain('audit');
  });

  it('honors a preferred tab when it is currently visible', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
      preferredTab: 'transcript',
    });
    expect(r.defaultTab).toBe('transcript');
  });

  it('falls back to receipt when the preferred tab is hidden', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: false,
      hasAnalysis: false,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
      preferredTab: 'analysis',
    });
    expect(r.defaultTab).toBe('receipt');
  });

  it('omits the shares tab when there are no shares', () => {
    const r = deriveMeetingDetailTabs({
      hasTranscript: true,
      hasAnalysis: true,
      actionItemCount: 0,
      shareCount: 0,
      isAdmin: false,
    });
    expect(r.visibleTabs).not.toContain('shares');
    expect(r.badges.shares).toBeNull();
  });
});
