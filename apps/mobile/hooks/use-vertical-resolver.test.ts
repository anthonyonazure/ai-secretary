import { describe, expect, it } from 'vitest';

import { resolveVertical } from './use-vertical-resolver.js';

describe('resolveVertical', () => {
  it('honors a user override above all else', () => {
    const r = resolveVertical({
      userOverride: 'medical',
      meetingHint: 'sales',
      calendarKeywords: ['discovery'],
      participantsCount: 4,
      tenantDefault: 'general',
    });
    expect(r.vertical).toBe('medical');
    expect(r.source).toBe('override');
    expect(r.confidence).toBe('high');
  });

  it('falls back to a server-supplied meeting hint', () => {
    const r = resolveVertical({
      userOverride: null,
      meetingHint: 'pm',
      calendarKeywords: [],
      participantsCount: 2,
      tenantDefault: 'general',
    });
    expect(r.vertical).toBe('pm');
    expect(r.source).toBe('hint');
  });

  it('infers from calendar keywords (case-insensitive)', () => {
    const r = resolveVertical({
      userOverride: null,
      meetingHint: null,
      calendarKeywords: ['Sprint Planning', 'Retro'],
      participantsCount: 6,
      tenantDefault: 'general',
    });
    expect(r.vertical).toBe('pm');
    expect(r.source).toBe('keywords');
    expect(r.confidence).toBe('high');
  });

  it('lowers confidence when only one keyword matches', () => {
    const r = resolveVertical({
      userOverride: null,
      meetingHint: null,
      calendarKeywords: ['Demo with Acme'],
      participantsCount: 3,
      tenantDefault: 'general',
    });
    expect(r.vertical).toBe('sales');
    expect(r.confidence).toBe('medium');
  });

  it('falls back to tenant default with low confidence on no signal', () => {
    const r = resolveVertical({
      userOverride: null,
      meetingHint: null,
      calendarKeywords: ['Quarterly check-in'],
      participantsCount: 5,
      tenantDefault: 'sales',
    });
    expect(r.vertical).toBe('sales');
    expect(r.source).toBe('tenant-default');
    expect(r.confidence).toBe('low');
  });

  it('disambiguates with the highest tally when multiple verticals match', () => {
    const r = resolveVertical({
      userOverride: null,
      meetingHint: null,
      calendarKeywords: ['Patient intake follow-up', 'discovery'],
      participantsCount: 2,
      tenantDefault: 'general',
    });
    expect(r.vertical).toBe('medical');
  });
});
