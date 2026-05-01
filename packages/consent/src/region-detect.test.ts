import { describe, expect, it } from 'vitest';
import { detectParticipantRegion } from './region-detect.js';

describe('detectParticipantRegion', () => {
  describe('ipCountry priority (highest)', () => {
    it('maps EU member ISO codes to "eu"', () => {
      for (const cc of ['DE', 'FR', 'IE', 'NL', 'IT', 'ES', 'PL']) {
        expect(detectParticipantRegion({ ipCountry: cc })).toBe('eu');
      }
    });

    it('maps EEA-aligned ISO codes (NO, IS, LI) to "eu"', () => {
      expect(detectParticipantRegion({ ipCountry: 'NO' })).toBe('eu');
      expect(detectParticipantRegion({ ipCountry: 'IS' })).toBe('eu');
      expect(detectParticipantRegion({ ipCountry: 'LI' })).toBe('eu');
    });

    it('maps US territories to "us"', () => {
      for (const cc of ['US', 'PR', 'VI', 'GU']) {
        expect(detectParticipantRegion({ ipCountry: cc })).toBe('us');
      }
    });

    it('returns "unknown" for non-EU/non-US ISO codes', () => {
      expect(detectParticipantRegion({ ipCountry: 'JP' })).toBe('unknown');
      expect(detectParticipantRegion({ ipCountry: 'BR' })).toBe('unknown');
      expect(detectParticipantRegion({ ipCountry: 'GB' })).toBe('unknown');
    });

    it('handles lowercase ISO codes', () => {
      expect(detectParticipantRegion({ ipCountry: 'de' })).toBe('eu');
      expect(detectParticipantRegion({ ipCountry: 'us' })).toBe('us');
    });

    it('overrides email/timezone when ipCountry is provided', () => {
      expect(
        detectParticipantRegion({
          ipCountry: 'US',
          email: 'someone@bundesverband.de',
          calendarTimezone: 'Europe/Berlin',
        }),
      ).toBe('us');
    });
  });

  describe('email TLD heuristic', () => {
    it('maps EU member ccTLDs to "eu"', () => {
      const cases: ReadonlyArray<[string, 'eu']> = [
        ['user@example.de', 'eu'],
        ['user@example.fr', 'eu'],
        ['user@example.ie', 'eu'],
        ['user@example.it', 'eu'],
        ['user@example.eu', 'eu'],
      ];
      for (const [email, expected] of cases) {
        expect(detectParticipantRegion({ email })).toBe(expected);
      }
    });

    it('returns "unknown" for generic gTLDs', () => {
      expect(detectParticipantRegion({ email: 'user@example.com' })).toBe('unknown');
      expect(detectParticipantRegion({ email: 'user@example.org' })).toBe('unknown');
      expect(detectParticipantRegion({ email: 'user@example.io' })).toBe('unknown');
    });

    it('returns "unknown" for malformed emails', () => {
      expect(detectParticipantRegion({ email: 'not-an-email' })).toBe('unknown');
      expect(detectParticipantRegion({ email: '@noTld' })).toBe('unknown');
    });

    it('returns "unknown" for UK (.uk) — see EU_TLDS comment', () => {
      expect(detectParticipantRegion({ email: 'user@example.co.uk' })).toBe('unknown');
    });
  });

  describe('calendar timezone fallback', () => {
    it('maps Europe/* to "eu"', () => {
      expect(detectParticipantRegion({ calendarTimezone: 'Europe/Berlin' })).toBe('eu');
      expect(detectParticipantRegion({ calendarTimezone: 'Europe/Dublin' })).toBe('eu');
    });

    it('maps America/* and US/* to "us"', () => {
      expect(detectParticipantRegion({ calendarTimezone: 'America/New_York' })).toBe('us');
      expect(detectParticipantRegion({ calendarTimezone: 'US/Pacific' })).toBe('us');
    });

    it('returns "unknown" for non-mapped IANA zones', () => {
      expect(detectParticipantRegion({ calendarTimezone: 'Asia/Tokyo' })).toBe('unknown');
      expect(detectParticipantRegion({ calendarTimezone: 'Pacific/Auckland' })).toBe('unknown');
    });
  });

  describe('all-empty input', () => {
    it('returns "unknown"', () => {
      expect(detectParticipantRegion({})).toBe('unknown');
    });
  });
});
