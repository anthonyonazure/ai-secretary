import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

import type {
  AnalysisBullet,
  AnalysisState,
  ModuleAction,
  ModuleId,
  ModuleOutput,
} from '@aisecretary/shared';

import { CitationChip } from './citation-chip';
import { moduleMeta } from './module-meta';

export type AnalysisCardVariant = 'inline' | 'standalone' | 'email';

export interface AnalysisCardProps {
  module: ModuleId;
  state: AnalysisState;
  variant?: AnalysisCardVariant;
  onAction?: (action: ModuleAction) => void;
}

/**
 * `AnalysisCard` — the single shell that renders all 8 vertical analysis
 * modules. Module-specific content lives in the discriminated `ModuleOutput`
 * union from `@aisecretary/shared`; the component dispatches on
 * `output.module` to render the right slot set, but the shell, density,
 * confidence chip, and action row are uniform across modules.
 *
 * Locked before module #1 (general) ships per UX spec U2 / Story 3.4 —
 * modules conform to this contract, never the other way around.
 */
export function AnalysisCard({ module, state, variant = 'inline', onAction }: AnalysisCardProps) {
  const meta = moduleMeta[module];
  const Icon = meta.icon;

  return (
    <article
      data-module={module}
      data-state={state.kind}
      data-variant={variant}
      className={cardClasses(variant)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-label={`${meta.label} module`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-accent-soft text-fg"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="font-sans text-base font-semibold text-fg leading-tight">
            {state.kind === 'streaming'
              ? state.stageLabel
              : state.kind === 'failed'
                ? 'Analysis unavailable'
                : state.output.title}
          </h2>
        </div>
        <ConfidenceBadge state={state} />
      </header>

      <div className="mt-3">
        {state.kind === 'streaming' ? <StreamingSkeleton /> : null}
        {state.kind === 'failed' ? (
          <FailedSlot state={state} onRetry={() => onAction?.('switch-vertical')} />
        ) : null}
        {state.kind === 'ready' || state.kind === 'low-confidence' || state.kind === 'override' ? (
          <ContentSlot output={state.output} />
        ) : null}
        {state.kind === 'override' ? (
          <OverrideNotice fromModule={state.fromModule} toModule={module} />
        ) : null}
      </div>

      {variant !== 'email' && state.kind !== 'streaming' && state.kind !== 'failed' ? (
        <ActionRow module={module} output={state.output} onAction={onAction} />
      ) : null}
    </article>
  );
}

function cardClasses(variant: AnalysisCardVariant): string {
  const base = 'block rounded-md border border-border bg-surface p-4';
  if (variant === 'standalone') return `${base} max-w-prose mx-auto shadow-md`;
  if (variant === 'email') return `${base} shadow-none`;
  return `${base} shadow-sm`;
}

function ConfidenceBadge({ state }: { state: AnalysisState }) {
  if (state.kind === 'streaming' || state.kind === 'failed') return null;
  if (state.kind === 'low-confidence') {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-warning/10 px-2 py-0.5 text-xs text-warning">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Low confidence
      </span>
    );
  }
  return null;
}

function StreamingSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-2">
      <SkeletonLine width="w-3/4" />
      <SkeletonLine width="w-full" />
      <SkeletonLine width="w-5/6" />
    </div>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return <div className={`h-3 rounded-sm bg-fg/10 ${width}`} />;
}

function FailedSlot({
  state,
  onRetry,
}: {
  state: Extract<AnalysisState, { kind: 'failed' }>;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-2 text-sm text-fg-muted">
      <ShieldAlert className="mt-0.5 h-4 w-4 text-danger" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-fg">{state.reason}</p>
        {state.retryable ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OverrideNotice({
  fromModule,
  toModule,
}: {
  fromModule: ModuleId;
  toModule: ModuleId;
}) {
  return (
    <p className="mt-3 rounded-sm border border-border bg-bg px-3 py-2 text-xs text-fg-muted">
      Vertical switched from{' '}
      <span className="font-medium text-fg">{moduleMeta[fromModule].label}</span> to{' '}
      <span className="font-medium text-fg">{moduleMeta[toModule].label}</span>. Original analysis
      is audit-logged.
    </p>
  );
}

function ContentSlot({ output }: { output: ModuleOutput }) {
  // Discriminated dispatch — each module surfaces its own slot set on top of
  // the shared `summary` + `bullets` baseline. Adding a vertical = author its
  // case below + the corresponding zod variant in
  // `packages/shared/src/schemas/module-output.ts`.
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg leading-normal">{output.summary}</p>
      <BulletList bullets={output.bullets} />
      {moduleSpecificSlots(output)}
    </div>
  );
}

function moduleSpecificSlots(output: ModuleOutput) {
  switch (output.module) {
    case 'sales':
      return (
        <div className="space-y-2">
          {output.talkRatio ? (
            <SlotRow label="Talk ratio">
              {`${Math.round(output.talkRatio.self * 100)}% / ${Math.round(output.talkRatio.counterpart * 100)}%`}
            </SlotRow>
          ) : null}
          {output.objections.length > 0 ? (
            <Slot label="Objections" bullets={output.objections} />
          ) : null}
          {output.nextSteps.length > 0 ? (
            <Slot label="Next steps" bullets={output.nextSteps} />
          ) : null}
          {output.dealRisk ? <SlotRow label="Deal risk">{output.dealRisk}</SlotRow> : null}
        </div>
      );
    case 'medical':
      return (
        <div className="space-y-2">
          {output.soap ? (
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <SoapRow term="Subjective" definition={output.soap.subjective} />
              <SoapRow term="Objective" definition={output.soap.objective} />
              <SoapRow term="Assessment" definition={output.soap.assessment} />
              <SoapRow term="Plan" definition={output.soap.plan} />
            </dl>
          ) : null}
          {output.riskFlags.length > 0 ? (
            <Slot label="Risk flags" bullets={output.riskFlags} />
          ) : null}
        </div>
      );
    case 'pm':
      return (
        <div className="space-y-2">
          {output.decisions.length > 0 ? (
            <Slot label="Decisions" bullets={output.decisions} />
          ) : null}
          {output.actionItems.length > 0 ? (
            <Slot label="Action items" bullets={output.actionItems} />
          ) : null}
          {output.risks.length > 0 ? <Slot label="Risks" bullets={output.risks} /> : null}
        </div>
      );
    case 'hr':
      return output.competencies.length > 0 ? (
        <Slot label="Competencies" bullets={output.competencies} />
      ) : null;
    case 'education':
      return (
        <div className="space-y-2">
          {output.engagement.length > 0 ? (
            <Slot label="Engagement" bullets={output.engagement} />
          ) : null}
          {output.objectiveCoverage.length > 0 ? (
            <Slot label="Objective coverage" bullets={output.objectiveCoverage} />
          ) : null}
        </div>
      );
    case 'support':
      return (
        <div className="space-y-2">
          {output.resolutionStatus ? (
            <SlotRow label="Resolution">{output.resolutionStatus}</SlotRow>
          ) : null}
          {output.escalationFlags.length > 0 ? (
            <Slot label="Escalation flags" bullets={output.escalationFlags} />
          ) : null}
        </div>
      );
    case 'psychology':
      return (
        <div className="space-y-2">
          {output.sessionThemes.length > 0 ? (
            <Slot label="Session themes" bullets={output.sessionThemes} />
          ) : null}
          {output.therapeuticAlliance ? (
            <SlotRow label="Therapeutic alliance">{output.therapeuticAlliance}</SlotRow>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

function Slot({ label, bullets }: { label: string; bullets: AnalysisBullet[] }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</h3>
      <BulletList bullets={bullets} />
    </section>
  );
}

function SlotRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-fg-muted">{label}:</span>{' '}
      <span className="text-fg">{children}</span>
    </p>
  );
}

function SoapRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{term}</dt>
      <dd className="text-sm text-fg leading-normal">{definition}</dd>
    </div>
  );
}

function BulletList({ bullets }: { bullets: AnalysisBullet[] }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {bullets.map((bullet, index) => (
        <li key={`${bullet.claim}-${index}`} className="text-sm text-fg leading-normal">
          <span className="mr-1 text-fg-muted">·</span>
          {bullet.claim}
          {bullet.citations.length > 0 ? (
            <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
              {bullet.citations.map((citation) => (
                <CitationChip
                  key={`${citation.meetingId}-${citation.turnId}`}
                  citation={citation}
                />
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ActionRow({
  module,
  output,
  onAction,
}: {
  module: ModuleId;
  output: ModuleOutput;
  onAction: ((action: ModuleAction) => void) | undefined;
}) {
  const actions = actionsForModule(module);
  if (actions.length === 0 || !onAction) return null;
  return (
    <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction(action.id)}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          {action.label}
        </button>
      ))}
      {/* Reference output to satisfy the contract surface — keeps the
          discriminated type alive at the boundary even when no module
          actions consume it directly. */}
      <span className="sr-only">{output.module}</span>
    </footer>
  );
}

function actionsForModule(module: ModuleId): Array<{ id: ModuleAction; label: string }> {
  switch (module) {
    case 'sales':
      return [{ id: 'push-to-crm', label: 'Push to CRM' }];
    case 'medical':
      return [{ id: 'edit-and-sign', label: 'Edit and sign' }];
    case 'pm':
      return [
        { id: 'open-decisions-log', label: 'Open decisions log' },
        { id: 'send-report', label: 'Send report' },
      ];
    case 'hr':
      return [{ id: 'open-rubric', label: 'Open rubric' }];
    default:
      return [];
  }
}
