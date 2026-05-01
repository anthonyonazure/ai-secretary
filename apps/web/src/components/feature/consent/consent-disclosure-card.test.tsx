import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsentDisclosureCard } from './consent-disclosure-card';

describe('ConsentDisclosureCard', () => {
  it('renders the disclosure body and org name', () => {
    render(
      <ConsentDisclosureCard
        organizationName="Acme Health"
        disclosureText="We're recording this visit so your clinician can focus on you."
      />,
    );
    expect(screen.getByTestId('consent-disclosure-card')).toBeInTheDocument();
    expect(screen.getByText(/Acme Health/)).toBeInTheDocument();
    expect(screen.getByTestId('consent-disclosure-body').textContent).toMatch(
      /We're recording this visit/,
    );
  });

  it('renders retention + region summaries when supplied', () => {
    render(
      <ConsentDisclosureCard
        organizationName="Acme Health"
        disclosureText="..."
        retentionSummary="Retained for 90 days"
        regionLabel="Stored in the European Union"
      />,
    );
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.getByText('Retained for 90 days')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Stored in the European Union')).toBeInTheDocument();
  });

  it('switches the variant via data-variant', () => {
    const { rerender } = render(
      <ConsentDisclosureCard organizationName="Acme" disclosureText="x" variant="inline" />,
    );
    expect(screen.getByTestId('consent-disclosure-card').dataset.variant).toBe('inline');
    rerender(
      <ConsentDisclosureCard organizationName="Acme" disclosureText="x" variant="screenshare" />,
    );
    expect(screen.getByTestId('consent-disclosure-card').dataset.variant).toBe('screenshare');
    rerender(<ConsentDisclosureCard organizationName="Acme" disclosureText="x" variant="link" />);
    expect(screen.getByTestId('consent-disclosure-card').dataset.variant).toBe('link');
  });

  it('renders the acknowledgment slot when supplied', () => {
    render(
      <ConsentDisclosureCard
        organizationName="Acme"
        disclosureText="x"
        acknowledgment={<button type="button">I acknowledge</button>}
      />,
    );
    expect(screen.getByText('I acknowledge')).toBeInTheDocument();
  });

  it('links to /data-rights by default', () => {
    render(<ConsentDisclosureCard organizationName="Acme" disclosureText="x" />);
    const link = screen.getByText('Your data rights') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/data-rights');
  });
});
