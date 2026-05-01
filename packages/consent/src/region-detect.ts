/**
 * Cheap participant-region heuristics — pure function, no I/O.
 *
 * Per arch-addendums § 7 + ADR-0005, region detection feeds the
 * legal-basis resolver. We deliberately return `'unknown'` rather
 * than guessing aggressively; the orchestrator promotes `'unknown'`
 * to `'eu'` when in doubt + tenantDefault === `'eu'`
 * (most-protective-applicable-rule).
 *
 * Sources, in priority order:
 *   1. ipCountry (ISO 3166-1 alpha-2) — most reliable when present
 *   2. emailDomain — TLD lookup against EU member-state list
 *   3. calendarTimezone — Europe/* IANA → 'eu'; America/* + US/* → 'us'
 *
 * NOT in scope here:
 *   - locale parsing (e.g. 'en-IE') — easy to spoof, deferred
 *   - Reverse geocoding — out of scope; would require remote call
 */

import type { ParticipantRegion } from './types.js';

/**
 * EU member-state + EEA-aligned ccTLDs that map to `'eu'`.
 * Story-3 follow-up: Anthony to confirm UK (.uk / .gb) treatment —
 * GDPR-derived but no longer EU member; currently NOT included so
 * UK participants resolve to `'unknown'` and the orchestrator's
 * tenant-default promotion kicks in.
 */
const EU_TLDS: ReadonlySet<string> = new Set([
  'eu',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'se',
  'dk',
  'fi',
  'ie',
  'pt',
  'gr',
  'cz',
  'at',
  'be',
  'lu',
  'ee',
  'lv',
  'lt',
  'sk',
  'si',
  'hr',
  'bg',
  'ro',
  'cy',
  'mt',
  'hu',
]);

/**
 * ISO 3166-1 alpha-2 → 'eu'. Uppercase; covers EU-27 + Iceland +
 * Liechtenstein + Norway (EEA). UK omitted — see EU_TLDS note.
 */
const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

const US_COUNTRIES: ReadonlySet<string> = new Set(['US', 'PR', 'VI', 'GU', 'MP', 'AS']);

export interface DetectInputs {
  email?: string;
  calendarTimezone?: string;
  ipCountry?: string;
}

/**
 * Returns `'eu' | 'us' | 'unknown'`. Conservative: any conflict or
 * missing signal → `'unknown'`. The orchestrator owns the tenant-default
 * promotion rule.
 */
export function detectParticipantRegion(input: DetectInputs): ParticipantRegion {
  // Priority 1: explicit ipCountry from upstream metadata pass.
  if (input.ipCountry) {
    const upper = input.ipCountry.toUpperCase();
    if (EU_COUNTRIES.has(upper)) return 'eu';
    if (US_COUNTRIES.has(upper)) return 'us';
    return 'unknown';
  }

  // Priority 2: email TLD heuristic.
  const emailRegion = regionFromEmail(input.email);
  if (emailRegion !== 'unknown') return emailRegion;

  // Priority 3: calendar IANA timezone (only Europe/* and America/* + US/*).
  const tzRegion = regionFromTimezone(input.calendarTimezone);
  if (tzRegion !== 'unknown') return tzRegion;

  return 'unknown';
}

function regionFromEmail(email: string | undefined): ParticipantRegion {
  if (!email) return 'unknown';
  const at = email.lastIndexOf('@');
  if (at < 0) return 'unknown';
  const domain = email.slice(at + 1).toLowerCase();
  const dot = domain.lastIndexOf('.');
  if (dot < 0) return 'unknown';
  const tld = domain.slice(dot + 1);
  if (EU_TLDS.has(tld)) return 'eu';
  // .com / .org / .net / .io etc. → 'unknown'. We don't infer 'us' from
  // generic gTLDs because they're globally registered.
  return 'unknown';
}

function regionFromTimezone(tz: string | undefined): ParticipantRegion {
  if (!tz) return 'unknown';
  const lower = tz.toLowerCase();
  if (lower.startsWith('europe/')) return 'eu';
  if (lower.startsWith('america/')) return 'us';
  if (lower.startsWith('us/')) return 'us';
  return 'unknown';
}
