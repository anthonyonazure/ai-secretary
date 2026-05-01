/**
 * `RetentionPolicyForm` — Story 12.3 admin UI.
 *
 * Two retention windows per tenant:
 *   - **audioDays** — `recordings` rows + their underlying audio
 *     objects are scrubbed after this many days.
 *   - **transcriptDays** — `meetings` rows (and via FK CASCADE every
 *     `speaker_turns` / `module_outputs` / `action_items` row tied to
 *     them) are deleted after this many days.
 *
 * Industry-typical defaults:
 *   - Free / Pro tenants: 365 / 365
 *   - Business: 90 / 365 (audio is shorter to save storage cost)
 *   - Enterprise: customer-configured, 1-3650 range
 *
 * Per-vertical overrides land in a follow-up — the medical vertical
 * needs a longer minimum (HIPAA + state laws often mandate 6+ years).
 */

import type { FormEvent } from 'react';
import { useState } from 'react';

export interface RetentionPolicyValue {
  audioDays: number;
  transcriptDays: number;
}

export interface RetentionPolicyFormProps {
  value: RetentionPolicyValue;
  isPending?: boolean;
  /** Hard floor — Enterprise plans can override past 1, Free / Pro
   *  cannot go below 30. Defaults to 1 if omitted. */
  minDays?: number;
  /** Hard ceiling — typically 3650 (10 years). */
  maxDays?: number;
  onSave: (value: RetentionPolicyValue) => void;
}

export function RetentionPolicyForm({
  value,
  isPending = false,
  minDays = 1,
  maxDays = 3650,
  onSave,
}: RetentionPolicyFormProps) {
  const [draft, setDraft] = useState(value);
  const [errors, setErrors] = useState<Partial<Record<keyof RetentionPolicyValue, string>>>({});

  const validate = (next: RetentionPolicyValue): typeof errors => {
    const e: typeof errors = {};
    for (const key of ['audioDays', 'transcriptDays'] as const) {
      const v = next[key];
      if (!Number.isFinite(v) || Math.floor(v) !== v) {
        e[key] = 'Must be a whole number of days.';
      } else if (v < minDays) {
        e[key] = `Minimum ${minDays} day${minDays === 1 ? '' : 's'}.`;
      } else if (v > maxDays) {
        e[key] = `Maximum ${maxDays} days.`;
      }
    }
    if (next.audioDays > next.transcriptDays) {
      e.audioDays = 'Audio retention cannot exceed transcript retention.';
    }
    return e;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validation = validate(draft);
    setErrors(validation);
    if (Object.keys(validation).length === 0) onSave(draft);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-md border border-border bg-surface p-5"
      data-testid="retention-policy-form"
      aria-label="Retention policy"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-semibold">Retention</legend>
        <p className="text-sm text-fg-muted">
          The retention worker runs nightly and purges data older than these windows. Audio is
          scrubbed first; transcript metadata follows on the longer window.
        </p>

        <DaysField
          id="audioDays"
          label="Audio recordings"
          helper="Underlying audio object + recording row are deleted after this many days."
          value={draft.audioDays}
          error={errors.audioDays}
          onChange={(v) => setDraft({ ...draft, audioDays: v })}
        />
        <DaysField
          id="transcriptDays"
          label="Transcripts + analysis"
          helper="Meeting row + speaker turns + module outputs + action items are deleted after this many days."
          value={draft.transcriptDays}
          error={errors.transcriptDays}
          onChange={(v) => setDraft({ ...draft, transcriptDays: v })}
        />
      </fieldset>

      <div className="flex">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="retention-policy-save"
        >
          {isPending ? 'Saving…' : 'Save retention policy'}
        </button>
      </div>
    </form>
  );
}

interface DaysFieldProps {
  id: string;
  label: string;
  helper: string;
  value: number;
  error?: string | undefined;
  onChange: (next: number) => void;
}

function DaysField({ id, label, helper, value, error, onChange }: DaysFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={1}
          max={3650}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`h-9 w-32 rounded-md border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            error ? 'border-danger' : 'border-border'
          }`}
          data-testid={`retention-${id}-input`}
        />
        <span className="text-sm text-fg-muted">days</span>
      </div>
      <p className="text-xs text-fg-muted">{helper}</p>
      {error ? (
        <p className="text-xs text-danger" data-testid={`retention-${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
