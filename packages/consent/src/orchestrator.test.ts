import { describe, expect, it } from 'vitest';
import { ConsentOrchestrator, surfacesFor } from './orchestrator.js';

describe('ConsentOrchestrator.surfacesFor', () => {
  it('returns shape A only for a US-default mobile-mic capture with no participants', () => {
    const surfaces = surfacesFor({
      meetingSource: 'mobile-mic',
      tenantPolicy: { default: 'us' },
      participants: [],
    });
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]?.shape).toBe('A');
    expect(surfaces[0]?.legalBasis).toBe('legitimate-interest');
    expect(surfaces[0]?.audience).toBe('recording-user');
  });

  it('appends shape C when org requires in-person consent for first-party capture', () => {
    const surfaces = surfacesFor({
      meetingSource: 'mobile-mic',
      tenantPolicy: { default: 'us', orgInPersonRequired: true },
      participants: [],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A', 'C']);
    expect(surfaces[1]?.audience).toBe('in-person-counterpart');
  });

  it('does NOT append shape C when meetingSource is upload', () => {
    const surfaces = surfacesFor({
      meetingSource: 'upload',
      tenantPolicy: { default: 'us', orgInPersonRequired: true },
      participants: [],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A']);
  });

  it('does NOT append shape C when meetingSource is bot', () => {
    const surfaces = surfacesFor({
      meetingSource: 'bot',
      tenantPolicy: { default: 'us', orgInPersonRequired: true },
      participants: [],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A']);
  });

  it('appends eu-explicit branch after shape A when participant is EU', () => {
    const surfaces = surfacesFor({
      meetingSource: 'web-mic',
      tenantPolicy: { default: 'us' },
      participants: [
        { id: 'p1', email: 'dana@firma.de' },
        { id: 'p2', email: 'mike@example.com' },
      ],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A', 'eu-explicit']);
    expect(surfaces[0]?.legalBasis).toBe('explicit-consent');
    expect(surfaces[1]?.participantRegions).toEqual([
      { participantId: 'p1', region: 'eu' },
      { participantId: 'p2', region: 'unknown' },
    ]);
  });

  it('combines eu-explicit + shape C in correct order', () => {
    const surfaces = surfacesFor({
      meetingSource: 'mobile-mic',
      tenantPolicy: { default: 'eu', orgInPersonRequired: true },
      participants: [{ id: 'p1', email: 'a@example.fr' }],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A', 'eu-explicit', 'C']);
    for (const s of surfaces) {
      expect(s.legalBasis).toBe('explicit-consent');
    }
  });

  it('omits eu-explicit branch when no participants are passed (even on EU default)', () => {
    // Surface only fires when there's at least one participant whose
    // exclusion contract needs surfacing. Without participants, shape A
    // already conveys the explicit-consent legal basis to the recording
    // user via the disclosure template.
    const surfaces = surfacesFor({
      meetingSource: 'mobile-mic',
      tenantPolicy: { default: 'eu' },
      participants: [],
    });
    expect(surfaces.map((s) => s.shape)).toEqual(['A']);
    expect(surfaces[0]?.legalBasis).toBe('explicit-consent');
  });

  it('namespace export and direct export return identical results', () => {
    const args = {
      meetingSource: 'mobile-mic' as const,
      tenantPolicy: { default: 'us' as const },
      participants: [],
    };
    expect(ConsentOrchestrator.surfacesFor(args)).toEqual(surfacesFor(args));
  });
});
