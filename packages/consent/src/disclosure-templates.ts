/**
 * Default disclosure copy. Locale-keyed; tenants can override per-org
 * via the `disclosureText` prop on the modal (which is sourced from
 * `tenant_settings` once the admin epic ships).
 *
 * Copy register: GOV.UK-style plain language (per UX spec § F1 +
 * Step 4 patient emotional target — "readable in <60 seconds").
 *
 * Story-3 follow-up: Anthony / content reviewer to confirm copy is
 * legally sufficient. Pre-implementation copy intentionally err on
 * the side of fewer claims.
 */

import type { ConsentLegalBasis, ConsentShape, DisclosureCopy } from './types.js';

type Locale = string;

interface TemplateInput {
  locale?: Locale;
  shape: ConsentShape;
  legalBasis: ConsentLegalBasis;
  orgName?: string;
}

const EN_BASE: Omit<DisclosureCopy, 'euExplicitNote' | 'euExplicitCheckboxLabel'> = {
  title: 'Before we start recording',
  bodyParagraphs: [
    'This meeting will be recorded so we can transcribe it, summarize key points, and let you search what was said later.',
    'The recording stays inside your organization. Only people you share it with can see it.',
  ],
  rightsLine:
    'You can ask for the recording to be deleted at any time, or request a copy of what we hold about you.',
  acknowledgeCta: 'I acknowledge',
  declineCta: 'Cancel',
};

const EN_SHAPE_C_BASE: Omit<DisclosureCopy, 'euExplicitNote' | 'euExplicitCheckboxLabel'> = {
  title: 'Scan to acknowledge recording',
  bodyParagraphs: [
    'The person you are meeting with would like to record this conversation.',
    'Scan the QR code to read what will be recorded, where it goes, and what your rights are.',
  ],
  rightsLine: 'You can ask for the recording to be deleted at any time after the meeting.',
  acknowledgeCta: 'I acknowledge',
  declineCta: 'Decline',
};

const EU_EXPLICIT_NOTE =
  'European participants must give explicit consent before being recorded. Anyone who does not opt in will be excluded from the transcript.';

const EU_EXPLICIT_CHECKBOX = 'I understand this requires explicit consent from EU participants.';

/**
 * Resolves the disclosure copy for a given consent surface.
 * `locale` is best-effort — falls through to English when the
 * requested locale isn't defined.
 */
export function getDisclosureCopy(input: TemplateInput): DisclosureCopy {
  const base = input.shape === 'C' ? { ...EN_SHAPE_C_BASE } : { ...EN_BASE };

  // Localized override hook — when i18next ships in apps/web (Story 1.7
  // territory) the wiring will swap this lookup for `t('consent.title')`.
  // For now: English only; non-`en` locales fall back without warning.
  // Story-3 follow-up: register translations.
  void input.locale;

  const copy: DisclosureCopy = {
    ...base,
    bodyParagraphs: input.orgName
      ? withOrgName(base.bodyParagraphs, input.orgName)
      : [...base.bodyParagraphs],
  };

  if (input.legalBasis === 'explicit-consent') {
    copy.euExplicitNote = EU_EXPLICIT_NOTE;
    copy.euExplicitCheckboxLabel = EU_EXPLICIT_CHECKBOX;
  }

  return copy;
}

function withOrgName(paragraphs: string[], orgName: string): string[] {
  // Prefix the first paragraph with the org name so the surface reads
  // as "Acme will record this meeting…" — matches the GOV.UK pattern of
  // identifying the party who holds the data up front.
  if (paragraphs.length === 0) return paragraphs;
  const [first, ...rest] = paragraphs;
  return [`${orgName} will use this recording. ${first ?? ''}`.trim(), ...rest];
}
