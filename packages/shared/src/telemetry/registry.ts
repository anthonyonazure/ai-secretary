/**
 * Telemetry ownership registry — Story 1.8.
 *
 * Every PostHog event the product fires MUST be declared here with a named
 * owner, review cadence, threshold-action mapping, sink, and retention. The
 * CI gate `check:telemetry` greps the codebase and fails if any
 * `track('event-name', ...)` call references a name not in this registry —
 * keeping observability honest by construction.
 *
 * Reasoning:
 *   - Unowned signals rot. The owner field forces an explicit human at
 *     review time + a clear escalation path when a threshold trips.
 *   - Threshold-action mapping turns dashboards from "interesting numbers"
 *     into "do X when Y", which is what gets flagged for ops triage.
 *   - Sink + retention are documented per-signal so privacy reviews can
 *     answer "where does this PII land + how long does it stick" without a
 *     cross-team dig.
 *
 * Adding a new signal:
 *   1. Author the entry below with all fields.
 *   2. Add the literal name to `TELEMETRY_SIGNAL_NAMES`.
 *   3. Reference it via `track(name, props)` from `./track.ts`.
 *
 * The `_bmad-output/planning-artifacts/open-work/telemetry-ownership-matrix.md`
 * doc is the human-readable companion; this module is the runtime
 * enforcement.
 */

export type TelemetryOwner =
  | 'Growth PM'
  | 'Product'
  | 'Engineering'
  | 'Compliance'
  | 'Customer Success'
  | 'Growth PM + Product';

export type TelemetryCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type TelemetrySink = 'posthog' | 'internal-table' | 'sentry';

export interface TelemetrySignal {
  /** Stable event name. Matches the literal string passed to `track()`. */
  name: string;
  /** Surface-level description — appears in PostHog property docs + the
   *  ownership-matrix companion doc. */
  description: string;
  /** Named accountable role. Single-owner — joint ownership cited as
   *  `'Growth PM + Product'` etc. */
  owner: TelemetryOwner;
  /** How often the owner reviews this signal. */
  cadence: TelemetryCadence;
  /** Specific number → specific action mapping. Free-form prose; the goal
   *  is "if X, then Y" so an on-call rotation can act without re-deriving. */
  thresholdAction: string;
  /** Where the event lands. */
  sink: TelemetrySink;
  /** Retention rule — drives privacy reviews. */
  retention: string;
  /** PII risk level — drives the privacy-review gate. */
  pii: 'none' | 'pseudonymous' | 'identifiable';
}

/**
 * Initial seed per Story 1.8 AC. Add new entries below + extend
 * `TELEMETRY_SIGNAL_NAMES` to keep the type narrow.
 */
export const TELEMETRY_REGISTRY: readonly TelemetrySignal[] = [
  {
    name: 'first-receipt-thumbs',
    description:
      'Thumbs-up/down captured on the first three receipts via the Story 1.7 first-receipt polish prompt.',
    owner: 'Growth PM',
    cadence: 'weekly',
    thresholdAction:
      '<60% positive over 50 responses → review the receipt content prompts; >85% → unblock the next module rollout.',
    sink: 'posthog',
    retention: '90 days, then aggregated counts only.',
    pii: 'pseudonymous',
  },
  {
    name: 'mental-model-free-text',
    description:
      'Free-text mental-model survey response captured during onboarding ("describe what AI Secretary will do for you").',
    owner: 'Growth PM + Product',
    cadence: 'weekly',
    thresholdAction:
      'Read every response weekly. Flag clusters where users misframe the product (e.g. "transcription tool only") for messaging fixes.',
    sink: 'internal-table',
    retention: '180 days; redacted via `dsar-export-reader` walk on tenant erasure.',
    pii: 'identifiable',
  },
  {
    name: '7d-activation-rate',
    description:
      'Percentage of new tenants whose first user records ≥1 meeting + visits the receipt within 7 days of signup.',
    owner: 'Growth PM',
    cadence: 'weekly',
    thresholdAction:
      '<30% rolling 28d → onboarding redesign sprint; >50% → next-gate kickoff (modules adoption).',
    sink: 'posthog',
    retention: 'Aggregated daily; raw events 30d.',
    pii: 'pseudonymous',
  },
  {
    name: 'tab-closer-reengagement-open-rate',
    description:
      'Email open rate on the 24h + 72h re-engagement emails dispatched by `re-engagement-scan` worker.',
    owner: 'Growth PM',
    cadence: 'monthly',
    thresholdAction:
      '<8% over 200 sends → subject-line A/B; >25% → expand the bucket window to 4d/7d.',
    sink: 'posthog',
    retention: '180 days.',
    pii: 'pseudonymous',
  },
] as const;

/**
 * Literal-string union of every registered signal name. Used by `track()`
 * to type-narrow the `name` argument so misspellings + unregistered names
 * are TS errors. The CI grep is the runtime backstop.
 */
export type TelemetrySignalName = (typeof TELEMETRY_REGISTRY)[number]['name'];

/** Runtime lookup — returns undefined for unregistered names. */
export function findTelemetrySignal(name: string): TelemetrySignal | undefined {
  return TELEMETRY_REGISTRY.find((s) => s.name === name);
}

/** All registered names — used by the CI grep gate + test fixtures. */
export const TELEMETRY_SIGNAL_NAMES: readonly string[] = TELEMETRY_REGISTRY.map((s) => s.name);
