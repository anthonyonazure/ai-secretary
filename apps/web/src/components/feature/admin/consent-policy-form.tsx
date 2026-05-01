/**
 * `ConsentPolicyForm` — Story 12.6 admin UI for region-aware consent.
 *
 * Two policy knobs:
 *   1. **Legal basis** (per region) — `explicit-per-participant` (default
 *      for EU + strict-policy tenants) or `legitimate-interest-implicit`
 *      (default elsewhere). Determines whether bots wait for an explicit
 *      chat-command opt-in window before recording per-participant
 *      audio.
 *   2. **Opt-out behavior** — what happens when a participant explicitly
 *      opts out: `auto-quarantine` removes the bot entirely; `per-
 *      participant-exclusion` keeps the bot in the meeting but excludes
 *      that participant's audio from transcripts and analysis.
 *
 * The bot service reads these at runtime via the tenant_settings
 * lookup; this component is the admin's edit surface.
 */

import type { FormEvent } from 'react';
import { useState } from 'react';

export type ConsentLegalBasis = 'explicit-per-participant' | 'legitimate-interest-implicit';

export type ConsentOptOutBehavior = 'auto-quarantine' | 'per-participant-exclusion';

export interface ConsentPolicy {
  legalBasis: ConsentLegalBasis;
  optOutBehavior: ConsentOptOutBehavior;
}

export interface ConsentPolicyFormProps {
  /** Current persisted policy. */
  value: ConsentPolicy;
  /** True while a save mutation is inflight. */
  isPending?: boolean;
  /** Called when the admin submits a change. */
  onSave: (policy: ConsentPolicy) => void;
}

export function ConsentPolicyForm({ value, isPending = false, onSave }: ConsentPolicyFormProps) {
  const [draft, setDraft] = useState<ConsentPolicy>(value);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft);
  };

  return (
    <form
      className="flex flex-col gap-6 rounded-md border border-border bg-surface p-5"
      onSubmit={handleSubmit}
      aria-label="Consent policy"
      data-testid="consent-policy-form"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold">Legal basis for recording</legend>
        <p className="text-sm text-fg-muted">
          Pick the basis that fits your jurisdiction + risk posture. EU + strict-policy tenants
          typically need <strong>explicit per-participant</strong>; most non-EU + non-clinical
          tenants run on <strong>legitimate interest</strong>.
        </p>
        <RadioField
          name="legalBasis"
          value="explicit-per-participant"
          checked={draft.legalBasis === 'explicit-per-participant'}
          onChange={(v) => setDraft({ ...draft, legalBasis: v as ConsentLegalBasis })}
          label="Explicit per-participant"
          description="Bot announces, then waits for each participant to opt in via chat command (60s window). Absent opt-in, that participant's audio is excluded."
          testId="consent-legal-basis-explicit"
        />
        <RadioField
          name="legalBasis"
          value="legitimate-interest-implicit"
          checked={draft.legalBasis === 'legitimate-interest-implicit'}
          onChange={(v) => setDraft({ ...draft, legalBasis: v as ConsentLegalBasis })}
          label="Legitimate interest (implicit)"
          description="Bot announces; staying in the meeting after the announcement counts as acknowledgment. Participants can opt out via chat command at any time."
          testId="consent-legal-basis-implicit"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-5">
        <legend className="text-base font-semibold">Opt-out behavior</legend>
        <p className="text-sm text-fg-muted">
          When a participant explicitly opts out, the bot can either leave the meeting entirely or
          stay and exclude that participant's audio from transcripts.
        </p>
        <RadioField
          name="optOutBehavior"
          value="auto-quarantine"
          checked={draft.optOutBehavior === 'auto-quarantine'}
          onChange={(v) => setDraft({ ...draft, optOutBehavior: v as ConsentOptOutBehavior })}
          label="Auto-quarantine (bot leaves)"
          description="Strictest option. The bot exits the meeting entirely — nothing is captured."
          testId="consent-optout-quarantine"
        />
        <RadioField
          name="optOutBehavior"
          value="per-participant-exclusion"
          checked={draft.optOutBehavior === 'per-participant-exclusion'}
          onChange={(v) => setDraft({ ...draft, optOutBehavior: v as ConsentOptOutBehavior })}
          label="Per-participant exclusion"
          description="The bot continues recording other participants. The opted-out participant's audio is excluded from transcripts and analysis."
          testId="consent-optout-exclude"
        />
      </fieldset>

      <div className="flex">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="consent-policy-save"
        >
          {isPending ? 'Saving…' : 'Save policy'}
        </button>
      </div>
    </form>
  );
}

interface RadioFieldProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  description: string;
  testId: string;
}

function RadioField({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  testId,
}: RadioFieldProps) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-md border bg-bg p-3 transition-colors ${
        checked ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent/50'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 h-4 w-4 accent-accent"
        data-testid={testId}
      />
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-fg-muted">{description}</span>
      </span>
    </label>
  );
}
