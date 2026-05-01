import { describe, expect, it } from 'vitest';
import { escapeHtml, registeredEmailKinds, renderTemplate } from './render.js';

describe('renderTemplate', () => {
  it('renders re-engagement-24h with full subject/html/text', () => {
    const out = renderTemplate(
      're-engagement-24h',
      { userName: 'Anthony', tenantName: 'Acme', resumeUrl: 'https://app.test/resume' },
      'en',
    );
    expect(out.subject).toContain('Anthony');
    expect(out.html).toContain('Acme');
    expect(out.html).toContain('https://app.test/resume');
    expect(out.text).toContain('Acme');
    expect(out.text).toContain('https://app.test/resume');
  });

  it('renders re-engagement-72h differently from 24h', () => {
    const ctx = { userName: 'A', tenantName: 'B', resumeUrl: 'https://x.test' };
    const a = renderTemplate('re-engagement-24h', ctx, 'en');
    const b = renderTemplate('re-engagement-72h', ctx, 'en');
    expect(a.subject).not.toBe(b.subject);
  });

  it('renders dsar-ready with download URL + expiry', () => {
    const out = renderTemplate(
      'dsar-ready',
      {
        userName: 'A',
        downloadUrl: 'https://download.test/abc',
        expiresAt: '2026-05-01T00:00:00Z',
        requestId: 'dsar-42',
      },
      'en',
    );
    expect(out.subject).toContain('export');
    expect(out.html).toContain('https://download.test/abc');
    expect(out.html).toContain('2026-05-01T00:00:00Z');
    expect(out.html).toContain('dsar-42');
    expect(out.text).toContain('dsar-42');
  });

  it('renders trial-ending-soon with daysLeft', () => {
    const out = renderTemplate(
      'trial-ending-soon',
      {
        userName: 'A',
        tenantName: 'Acme',
        daysLeft: 2,
        upgradeUrl: 'https://app.test/billing',
      },
      'en',
    );
    expect(out.subject).toContain('2 day');
    expect(out.html).toContain('https://app.test/billing');
  });

  it('renders trial-expired with reactivate CTA', () => {
    const out = renderTemplate(
      'trial-expired',
      { userName: 'A', tenantName: 'Acme', upgradeUrl: 'https://app.test/billing' },
      'en',
    );
    expect(out.subject).toContain('ended');
    expect(out.html).toContain('Reactivate');
  });

  it('throws for unregistered kind', () => {
    expect(() => renderTemplate('share-received-slack', {}, 'en')).toThrow(/No email template/);
  });

  it('lists all registered kinds', () => {
    const kinds = registeredEmailKinds();
    expect(kinds).toContain('re-engagement-24h');
    expect(kinds).toContain('re-engagement-72h');
    expect(kinds).toContain('dsar-ready');
    expect(kinds).toContain('trial-ending-soon');
    expect(kinds).toContain('trial-expired');
  });
});

describe('escapeHtml', () => {
  it('escapes the canonical XSS vectors', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeHtml("it's")).toBe('it&#39;s');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes user input embedded in subject + html', () => {
    const out = renderTemplate(
      're-engagement-24h',
      {
        userName: '<img src=x onerror=alert(1)>',
        tenantName: 'Acme',
        resumeUrl: 'https://x.test',
      },
      'en',
    );
    expect(out.html).not.toContain('<img src=x');
    expect(out.html).toContain('&lt;img');
  });
});
