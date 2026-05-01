/**
 * CRM host detection — Story 15.3 substrate.
 *
 * The content script runs on every URL matched by the manifest's
 * `content_scripts.matches` list. The detector classifies which CRM
 * is active so the F5-CRM flow can pick the right DOM probes for
 * attendee + deal extraction.
 *
 * Pure function — passes any document.location-like input as the
 * `hostname` argument; tests don't need a DOM.
 */

export type CrmHost = 'hubspot' | 'salesforce' | 'pipedrive' | 'unknown';

const SALESFORCE_PATTERNS = ['.salesforce.com', '.lightning.force.com'];

export const detectCrmHost = (hostname: string): CrmHost => {
  const host = hostname.toLowerCase();
  if (host.includes('.hubspot.com')) return 'hubspot';
  if (SALESFORCE_PATTERNS.some((p) => host.includes(p))) return 'salesforce';
  if (host.includes('.pipedrive.com')) return 'pipedrive';
  return 'unknown';
};
