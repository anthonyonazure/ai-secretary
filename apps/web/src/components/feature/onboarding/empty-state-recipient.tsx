/**
 * `EmptyStateRecipient` — Story 1.7.
 *
 * First-launch home for a brand-new user who has zero meetings. Per
 * UX spec § F2 user first-launch flow + § Empty-state activation
 * design, we present two co-equal paths: a sample-meeting library
 * (synthetic content only) and an "import existing audio" CTA.
 *
 * Component skeleton works without illustrations (designer brief
 * landing in parallel). The layout reserves space for the eventual
 * hand-drawn empty-state illustration — slot is intentionally empty
 * for now and gated behind the optional `illustration` prop so
 * Storybook / future stories can wire it without a code change.
 *
 * Story 1.9 — default headline + subheadline come from the active
 * locale; the subheadline interpolates the per-vertical anchor word
 * (Story 1.9 anchor-word substrate). Callers may still override with
 * literal copy via the `headline` / `subheadline` props (used by
 * Storybook).
 */

import { useT } from '../../../i18n/use-t';
import { ImportCta } from './import-cta';
import { SampleLibrary } from './sample-library';

export interface EmptyStateRecipientProps {
  /** Optional illustration node — designer brief follow-up. */
  illustration?: React.ReactNode;
  /** Optional headline override (defaults to localized copy). */
  headline?: string;
  /** Optional supporting copy override. */
  subheadline?: string;
}

export function EmptyStateRecipient({
  illustration,
  headline,
  subheadline,
}: EmptyStateRecipientProps) {
  const { t, anchor } = useT();
  const resolvedHeadline = headline ?? t('onboarding.empty.heading');
  const resolvedSubheadline = subheadline ?? t('onboarding.empty.subheading', { anchor: anchor() });

  return (
    <section
      aria-labelledby="empty-state-recipient-heading"
      data-testid="empty-state-recipient"
      className="flex flex-col gap-8"
    >
      <header className="flex flex-col gap-3">
        {illustration ? (
          <div aria-hidden="true" data-testid="empty-state-illustration" className="max-w-sm">
            {illustration}
          </div>
        ) : null}
        <h1 id="empty-state-recipient-heading" className="font-sans text-2xl font-semibold text-fg">
          {resolvedHeadline}
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted">{resolvedSubheadline}</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <SampleLibrary />
        <ImportCta />
      </div>
    </section>
  );
}
