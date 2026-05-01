/**
 * `ConsentDisclosureCard` — Story 14.6 (full clinical disclosure
 * artifact, FR50/U6 substrate).
 *
 * Three variants render the same disclosure body in three contexts:
 *
 *   - 'inline'      — appears inside the F2 pre-recording surface
 *   - 'screenshare' — large-text, screenshot-friendly view for
 *                     in-person clinical settings (provider shows the
 *                     disclosure to the patient on a screen-shared
 *                     device)
 *   - 'link'        — public, auth-free shareable view at a token URL
 *
 * Plain-language register (GOV.UK style) per UX spec § Step 11. WCAG
 * AA contrast across the locked palette is verified by the
 * design-tokens contrast CI gate; this component sticks to token
 * classes only.
 */

import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export type ConsentDisclosureVariant = 'inline' | 'screenshare' | 'link';

export interface ConsentDisclosureCardProps {
  variant?: ConsentDisclosureVariant;
  /** Org / clinic name displayed prominently in the heading. */
  organizationName: string;
  /** Configurable disclosure copy — typically pulled from
   *  `tenant_settings.disclosure_text_*` per Story 12.1. */
  disclosureText: string;
  /** Optional retention summary line — "Retained for 90 days". */
  retentionSummary?: string;
  /** Optional region label — "Stored in the European Union". */
  regionLabel?: string;
  /** Slot for the acknowledgment control (checkbox + button), passed
   *  in by the host so the same body works for both clinical (signed)
   *  and informational (read-only) contexts. */
  acknowledgment?: ReactNode;
  /** Localized label for the data-rights link footer. */
  dataRightsLinkLabel?: string;
  /** Target URL for the data-rights footer. Defaults to the public
   *  DSAR portal at `/data-rights`. */
  dataRightsUrl?: string;
}

const variantClasses: Record<
  ConsentDisclosureVariant,
  { card: string; heading: string; body: string }
> = {
  inline: {
    card: 'rounded-md border border-border bg-surface p-4',
    heading: 'text-lg font-semibold',
    body: 'mt-2 text-sm leading-relaxed text-fg',
  },
  screenshare: {
    card: 'rounded-lg border-2 border-border bg-surface p-8 shadow-md',
    heading: 'text-3xl font-semibold leading-tight',
    body: 'mt-4 text-xl leading-loose text-fg',
  },
  link: {
    card: 'mx-auto max-w-2xl rounded-md border border-border bg-surface p-6',
    heading: 'text-xl font-semibold',
    body: 'mt-3 text-base leading-relaxed text-fg',
  },
};

export function ConsentDisclosureCard({
  variant = 'inline',
  organizationName,
  disclosureText,
  retentionSummary,
  regionLabel,
  acknowledgment,
  dataRightsLinkLabel = 'Your data rights',
  dataRightsUrl = '/data-rights',
}: ConsentDisclosureCardProps) {
  const v = variantClasses[variant];
  return (
    <article
      className={v.card}
      data-testid="consent-disclosure-card"
      data-variant={variant}
      aria-label={`Recording disclosure from ${organizationName}`}
    >
      <header className="flex items-center gap-2">
        <ShieldCheck
          aria-hidden="true"
          className={variant === 'screenshare' ? 'h-8 w-8 text-fg' : 'h-5 w-5 text-fg'}
        />
        <h2 className={v.heading}>
          {organizationName}{' '}
          {variant === 'screenshare' ? 'is recording this conversation.' : 'is recording'}
        </h2>
      </header>

      <p className={v.body} data-testid="consent-disclosure-body">
        {disclosureText}
      </p>

      {retentionSummary || regionLabel ? (
        <dl
          className={`mt-4 grid grid-cols-1 gap-2 text-sm text-fg-muted ${variant === 'screenshare' ? 'text-base' : ''} sm:grid-cols-2`}
        >
          {retentionSummary ? (
            <div>
              <dt className="font-medium text-fg">Retention</dt>
              <dd>{retentionSummary}</dd>
            </div>
          ) : null}
          {regionLabel ? (
            <div>
              <dt className="font-medium text-fg">Region</dt>
              <dd>{regionLabel}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {acknowledgment ? <div className="mt-6">{acknowledgment}</div> : null}

      <footer className="mt-6 border-t border-border pt-3 text-xs text-fg-muted">
        <a
          href={dataRightsUrl}
          className="text-accent underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          {dataRightsLinkLabel}
        </a>
      </footer>
    </article>
  );
}
