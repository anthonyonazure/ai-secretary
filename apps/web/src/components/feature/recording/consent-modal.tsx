/**
 * Story 4.3 — Pre-mic consent modal (consent shape A).
 *
 * Replaces `consent-modal-stub.tsx`. Renders the org-configurable
 * disclosure (per `@aisecretary/consent` `getDisclosureCopy`) and gates
 * `startRecording` until acknowledged.
 *
 * EU explicit branch: when `legalBasis === 'explicit-consent'`, an
 * additional checkbox is required affirming the recording user
 * understands their EU participants need explicit consent.
 *
 * A11y:
 *   - Radix Dialog primitives provide role="dialog" aria-modal="true",
 *     focus trap, ESC handler, and inert background.
 *   - 44px minimum touch targets (min-h-11) on every interactive control.
 */

import {
  type ConsentLegalBasis,
  type DisclosureCopy,
  getDisclosureCopy,
} from '@aisecretary/consent';
import * as Dialog from '@radix-ui/react-dialog';
import { useId, useMemo, useState } from 'react';

export interface ConsentModalProps {
  open: boolean;
  legalBasis: ConsentLegalBasis;
  /** Org-configurable extra paragraph appended to the default body. */
  customDisclosure?: string;
  /** Org name — interpolated into the default copy when present. */
  orgName?: string;
  /** Locale hint; English fallback for now (see disclosure-templates). */
  locale?: string;
  onAcknowledge: () => void;
  onDecline: () => void;
}

export function ConsentModal({
  open,
  legalBasis,
  customDisclosure,
  orgName,
  locale,
  onAcknowledge,
  onDecline,
}: ConsentModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [euAffirmed, setEuAffirmed] = useState(false);

  const copy: DisclosureCopy = useMemo(
    () =>
      getDisclosureCopy({
        shape: 'A',
        legalBasis,
        ...(orgName !== undefined ? { orgName } : {}),
        ...(locale !== undefined ? { locale } : {}),
      }),
    [legalBasis, orgName, locale],
  );

  const requiresEuAffirmation = legalBasis === 'explicit-consent';
  const canSubmit = acknowledged && (!requiresEuAffirmation || euAffirmed);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // ESC / overlay click counts as decline.
      onDecline();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm motion-reduced:backdrop-blur-none"
          data-testid="consent-modal-overlay"
        />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface p-6 shadow-lg focus:outline-none"
        >
          <Dialog.Title
            id={titleId}
            className="font-sans text-lg font-semibold leading-tight text-fg"
          >
            {copy.title}
          </Dialog.Title>
          <Dialog.Description id={descriptionId} className="sr-only">
            Acknowledge the recording disclosure to start your meeting.
          </Dialog.Description>

          <div className="mt-3 flex flex-col gap-3 text-sm text-fg">
            {copy.bodyParagraphs.map((paragraph, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: copy paragraphs are stable per render
              <p key={idx} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
            {customDisclosure ? (
              <p className="leading-relaxed text-fg-muted">{customDisclosure}</p>
            ) : null}
            <p className="leading-relaxed text-fg-muted">{copy.rightsLine}</p>
            {copy.euExplicitNote ? (
              <p
                className="rounded-md border border-border bg-accent-soft/40 p-3 leading-relaxed text-fg"
                data-testid="consent-modal-eu-note"
              >
                {copy.euExplicitNote}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex min-h-11 items-start gap-3 text-sm text-fg">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 cursor-pointer accent-accent"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                data-testid="consent-modal-ack-checkbox"
              />
              <span>I have read this disclosure and acknowledge the recording.</span>
            </label>
            {requiresEuAffirmation && copy.euExplicitCheckboxLabel ? (
              <label className="flex min-h-11 items-start gap-3 text-sm text-fg">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 cursor-pointer accent-accent"
                  checked={euAffirmed}
                  onChange={(e) => setEuAffirmed(e.target.checked)}
                  data-testid="consent-modal-eu-checkbox"
                />
                <span>{copy.euExplicitCheckboxLabel}</span>
              </label>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onDecline}
              className="inline-flex min-h-11 min-w-11 items-center rounded-md border border-border bg-bg px-4 text-sm text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              data-testid="consent-modal-decline"
            >
              {copy.declineCta}
            </button>
            <button
              type="button"
              onClick={onAcknowledge}
              disabled={!canSubmit}
              className="inline-flex min-h-11 min-w-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="consent-modal-acknowledge"
            >
              {copy.acknowledgeCta}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
