import { describe, expect, it } from 'vitest';

import { detectCrmHost } from './crm-detector.js';

describe('detectCrmHost', () => {
  it('detects HubSpot', () => {
    expect(detectCrmHost('app.hubspot.com')).toBe('hubspot');
    expect(detectCrmHost('app-na1.hubspot.com')).toBe('hubspot');
  });

  it('detects Salesforce (classic + Lightning)', () => {
    expect(detectCrmHost('mycompany.salesforce.com')).toBe('salesforce');
    expect(detectCrmHost('mycompany.my.salesforce.com')).toBe('salesforce');
    expect(detectCrmHost('mycompany.lightning.force.com')).toBe('salesforce');
  });

  it('detects Pipedrive', () => {
    expect(detectCrmHost('mycompany.pipedrive.com')).toBe('pipedrive');
  });

  it('returns unknown for unrelated hosts', () => {
    expect(detectCrmHost('example.com')).toBe('unknown');
    expect(detectCrmHost('mail.google.com')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(detectCrmHost('APP.HUBSPOT.COM')).toBe('hubspot');
  });
});
