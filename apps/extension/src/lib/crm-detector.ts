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

const SALESFORCE_DOMAINS = ['salesforce.com', 'lightning.force.com'];

/**
 * True when `host` is `domain` itself or a subdomain of it. A substring test
 * is not enough: `app.hubspot.com.attacker.example` contains `.hubspot.com`
 * but belongs to whoever owns attacker.example.
 */
const isHostOrSubdomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`);

export const detectCrmHost = (hostname: string): CrmHost => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (isHostOrSubdomain(host, 'hubspot.com')) return 'hubspot';
  if (SALESFORCE_DOMAINS.some((d) => isHostOrSubdomain(host, d))) return 'salesforce';
  if (isHostOrSubdomain(host, 'pipedrive.com')) return 'pipedrive';
  return 'unknown';
};
