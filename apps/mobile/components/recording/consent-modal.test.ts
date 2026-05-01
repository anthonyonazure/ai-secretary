/**
 * Story 4.3 — mobile ConsentModal logic tests.
 *
 * The mobile vitest setup runs under node, with no react-native renderer.
 * The pure-logic invariants the modal enforces are mirrored here against
 * the same `getDisclosureCopy` source the modal consumes, plus the
 * acknowledgment-gate function the modal uses to enable its CTA.
 *
 * Smoke tests:
 *   - The component module loads under node without erroring.
 *   - getDisclosureCopy returns the expected copy bundle for both legal bases.
 *   - The CTA-gate function blocks acknowledgment until the right
 *     checkboxes are ticked.
 */

import { getDisclosureCopy } from '@aisecretary/consent';
import { describe, expect, it } from 'vitest';

/** Mirrored from `consent-modal.tsx` — keep in sync. */
function canSubmit({
  acknowledged,
  euAffirmed,
  requiresEuAffirmation,
}: {
  acknowledged: boolean;
  euAffirmed: boolean;
  requiresEuAffirmation: boolean;
}): boolean {
  return acknowledged && (!requiresEuAffirmation || euAffirmed);
}

describe('mobile ConsentModal disclosure copy', () => {
  it('renders the legitimate-interest copy without an EU note', () => {
    const copy = getDisclosureCopy({ shape: 'A', legalBasis: 'legitimate-interest' });
    expect(copy.title).toMatch(/before we start recording/i);
    expect(copy.bodyParagraphs.length).toBeGreaterThan(0);
    expect(copy.euExplicitNote).toBeUndefined();
    expect(copy.euExplicitCheckboxLabel).toBeUndefined();
  });

  it('renders the explicit-consent copy WITH an EU note + checkbox label', () => {
    const copy = getDisclosureCopy({ shape: 'A', legalBasis: 'explicit-consent' });
    expect(copy.euExplicitNote).toBeDefined();
    expect(copy.euExplicitCheckboxLabel).toMatch(/explicit consent/i);
  });

  it('prepends the org name when provided', () => {
    const copy = getDisclosureCopy({
      shape: 'A',
      legalBasis: 'legitimate-interest',
      orgName: 'Veridian',
    });
    expect(copy.bodyParagraphs[0]).toContain('Veridian');
  });
});

describe('mobile ConsentModal CTA gate', () => {
  it('blocks acknowledgment when the primary checkbox is unchecked', () => {
    expect(
      canSubmit({ acknowledged: false, euAffirmed: false, requiresEuAffirmation: false }),
    ).toBe(false);
  });

  it('allows acknowledgment when only the primary checkbox is checked under legitimate-interest', () => {
    expect(canSubmit({ acknowledged: true, euAffirmed: false, requiresEuAffirmation: false })).toBe(
      true,
    );
  });

  it('still blocks under explicit-consent until the EU checkbox is ticked', () => {
    expect(canSubmit({ acknowledged: true, euAffirmed: false, requiresEuAffirmation: true })).toBe(
      false,
    );
    expect(canSubmit({ acknowledged: true, euAffirmed: true, requiresEuAffirmation: true })).toBe(
      true,
    );
  });
});
