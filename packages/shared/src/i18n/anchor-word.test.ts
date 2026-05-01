import { describe, expect, it } from 'vitest';
import { moduleIds } from '../schemas/module-output.js';
import {
  type SupportedLocale,
  __anchorWordTable,
  anchorWord,
  defaultAnchorWord,
  supportedLocales,
} from './anchor-word.js';

describe('anchorWord (Story 1.9)', () => {
  it('returns "receipt" / "reçu" for the platform-wide default', () => {
    expect(anchorWord({ locale: 'en' })).toBe('receipt');
    expect(anchorWord({ locale: 'fr' })).toBe('reçu');
  });

  it('returns "session note" / "compte rendu" for clinical + education verticals', () => {
    for (const vertical of ['medical', 'psychology', 'education'] as const) {
      expect(anchorWord({ locale: 'en', vertical })).toBe('session note');
      expect(anchorWord({ locale: 'fr', vertical })).toBe('compte rendu');
    }
  });

  it('keeps non-clinical verticals on the default anchor word', () => {
    for (const vertical of ['general', 'sales', 'hr', 'support', 'pm'] as const) {
      expect(anchorWord({ locale: 'en', vertical })).toBe('receipt');
      expect(anchorWord({ locale: 'fr', vertical })).toBe('reçu');
    }
  });

  it('falls back to the general vertical when vertical is omitted', () => {
    expect(anchorWord({ locale: 'en' })).toBe(anchorWord({ locale: 'en', vertical: 'general' }));
    expect(anchorWord({ locale: 'fr' })).toBe(anchorWord({ locale: 'fr', vertical: 'general' }));
  });

  it('covers every (locale, vertical) pair in the table', () => {
    for (const locale of supportedLocales) {
      for (const vertical of moduleIds) {
        const word = anchorWord({ locale, vertical });
        expect(typeof word).toBe('string');
        expect(word.length).toBeGreaterThan(0);
        // Confirm the lookup is symmetric with the underlying table.
        expect(word).toBe(__anchorWordTable[vertical][locale]);
      }
    }
  });

  it('defaultAnchorWord is the locale-only convenience for general', () => {
    for (const locale of supportedLocales) {
      expect(defaultAnchorWord(locale)).toBe(anchorWord({ locale, vertical: 'general' }));
    }
  });

  it('treats unknown verticals (cast through the type) as general', () => {
    // Simulate a runtime value that snuck past the type system; the
    // helper must not crash.
    const word = anchorWord({
      locale: 'en' as SupportedLocale,
      vertical: 'mystery' as unknown as 'general',
    });
    expect(word).toBe('receipt');
  });
});
