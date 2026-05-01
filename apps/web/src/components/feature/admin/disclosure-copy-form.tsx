/**
 * `DisclosureCopyForm` — Story 12.4 admin UI (FR45 + FR46 + FR47).
 *
 * Three text fields + two toggles + a read-only region pin row:
 *   1. **Pre-mic disclosure** — F2 user pre-recording surface
 *   2. **Bot announcement disclosure** — Zoom/Teams bot TTS
 *   3. **Patient-artifact disclosure** — clinical fixed-text artifact
 *      (consent shape D)
 *   4. **In-person 3rd-party consent toggle** — recording UI gates
 *      capture until each on-screen participant taps "consent"
 *   5. **Region pin** — read-only after F2-admin region-pin
 *      transition (one-shot per ADR-0004)
 *
 * The text fields render with a generous min-height (clinical
 * disclosure copy is often ~5 sentences). Plain-language register
 * (UX spec § Step 11 GOV.UK style) per the ConsentDisclosureCard
 * component (Story 14.6).
 */

import { Globe2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

export interface DisclosureCopyValue {
  preMic: string;
  botAnnouncement: string;
  patientArtifact: string;
  inPersonConsentRequired: boolean;
}

export interface DisclosureCopyFormProps {
  value: DisclosureCopyValue;
  /** Region the tenant is pinned to — read-only display. */
  region: 'us' | 'eu';
  /** True if the F2-admin region-pin step has happened. */
  regionPinned: boolean;
  /** Saving inflight. */
  isPending?: boolean;
  onSave: (value: DisclosureCopyValue) => void;
}

const REGION_LABEL: Record<'us' | 'eu', string> = {
  us: 'United States (us-east-1)',
  eu: 'European Union (eu-west-1)',
};

export function DisclosureCopyForm({
  value,
  region,
  regionPinned,
  isPending = false,
  onSave,
}: DisclosureCopyFormProps) {
  const [draft, setDraft] = useState<DisclosureCopyValue>(value);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-md border border-border bg-surface p-5"
      aria-label="Disclosure copy + region"
      data-testid="disclosure-copy-form"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold">Disclosure copy</legend>
        <p className="text-sm text-fg-muted">
          The pre-mic disclosure renders inside the recording surface; the bot announcement is read
          aloud when the bot joins a Zoom or Teams meeting; the patient-artifact copy is shown on
          the clinical disclosure card.
        </p>

        <TextareaField
          id="preMic"
          label="Pre-mic disclosure"
          helper="Shown above the record button. Plain-language register."
          value={draft.preMic}
          onChange={(v) => setDraft({ ...draft, preMic: v })}
        />
        <TextareaField
          id="botAnnouncement"
          label="Bot announcement"
          helper="Read aloud when the meeting bot joins. ~12 seconds max."
          value={draft.botAnnouncement}
          onChange={(v) => setDraft({ ...draft, botAnnouncement: v })}
        />
        <TextareaField
          id="patientArtifact"
          label="Patient-artifact disclosure"
          helper="Used by the medical / psychology consent card. Plain-language clinical register."
          value={draft.patientArtifact}
          onChange={(v) => setDraft({ ...draft, patientArtifact: v })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-5">
        <legend className="text-base font-semibold">In-person 3rd-party consent</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-bg p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
          <input
            type="checkbox"
            checked={draft.inPersonConsentRequired}
            onChange={(e) => setDraft({ ...draft, inPersonConsentRequired: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-accent"
            data-testid="disclosure-in-person-toggle"
          />
          <span className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">Require in-person 3rd-party consent</span>
            <span className="text-fg-muted">
              When enabled, the recording UI blocks capture until each on-screen participant taps
              the "I consent" affordance. Required for two-party-consent jurisdictions.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2 border-t border-border pt-5">
        <legend className="text-base font-semibold">Region</legend>
        <div className="flex items-center gap-3 rounded-md bg-bg p-3 text-sm">
          <Globe2 className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          <span data-testid="disclosure-region-display">
            <span className="font-medium">{REGION_LABEL[region]}</span>
            <span className="ml-2 text-fg-muted">
              {regionPinned
                ? '· pinned (immutable per ADR-0004)'
                : '· not yet pinned — see F2-admin'}
            </span>
          </span>
        </div>
      </fieldset>

      <div className="flex">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="disclosure-copy-save"
        >
          {isPending ? 'Saving…' : 'Save disclosure copy'}
        </button>
      </div>
    </form>
  );
}

interface TextareaFieldProps {
  id: string;
  label: string;
  helper: string;
  value: string;
  onChange: (next: string) => void;
}

function TextareaField({ id, label, helper, value, onChange }: TextareaFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-border bg-bg p-3 font-sans text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid={`disclosure-${id}-input`}
      />
      <p className="text-xs text-fg-muted">{helper}</p>
    </div>
  );
}
