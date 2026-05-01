import { z } from 'zod';

/**
 * The 8 vertical analysis modules. Each module owns a config under
 * `packages/modules/<id>.ts` with prompt + output schema + scoring rules.
 * The shape below is the discriminated union the rest of the system
 * (workers, API, AnalysisCard) consumes.
 *
 * Adding a vertical = author one config file. No platform deploy.
 */
export const moduleIds = [
  'general',
  'sales',
  'hr',
  'education',
  'medical',
  'support',
  'pm',
  'psychology',
] as const;
export const moduleIdSchema = z.enum(moduleIds);
export type ModuleId = z.infer<typeof moduleIdSchema>;

/**
 * Citation reference embedded inside any module output. Deep-link contract
 * is `(meetingId, turnId)` per Story 2.4 + Story 3.5 (`speaker_turns` table
 * has stable hash IDs). Span fields stay on the citation for player seek
 * + 5s pre-roll behavior.
 */
export const citationRefSchema = z.object({
  meetingId: z.string().uuid(),
  turnId: z.string(),
  spanStartMs: z.number().int().nonnegative(),
  spanEndMs: z.number().int().nonnegative(),
  speaker: z.string().optional(),
});
export type CitationRef = z.infer<typeof citationRefSchema>;

/**
 * Confidence is a coarse three-state signal — `null` means "not yet
 * scored" (streaming). Module configs define thresholds that map raw
 * scores to high/low.
 */
export const confidenceSchema = z.union([z.literal('high'), z.literal('low'), z.null()]);
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * A single annotated bullet rendered inside a content slot. Modules define
 * which slots they emit (e.g. sales = `talkRatio`, `objections`,
 * `nextSteps`, `dealRisk`). The `claim` carries inline citations so the
 * `AnalysisCard` can render `CitationChip` V2 next to the prose.
 */
export const analysisBulletSchema = z.object({
  claim: z.string(),
  citations: z.array(citationRefSchema).default([]),
});
export type AnalysisBullet = z.infer<typeof analysisBulletSchema>;

/**
 * Vertical-specific action exposed in the action row of `AnalysisCard`.
 * The component fires these through `onAction`; the host wires them to the
 * appropriate workflow (Push to CRM → Epic 15 F5-CRM, Edit and sign →
 * Epic 6 medical, Send report → Epic 9 share flow, etc.).
 */
export const moduleActionSchema = z.enum([
  'push-to-crm',
  'edit-and-sign',
  'send-report',
  'open-decisions-log',
  'open-rubric',
  'switch-vertical',
]);
export type ModuleAction = z.infer<typeof moduleActionSchema>;

/**
 * Per-module output shape — the discriminated union that the AnalysisCard
 * walks at runtime. Each variant carries a `module` discriminator + a
 * minimal slot set that matches the locked UX spec for that vertical.
 *
 * The slots below are the Phase-0 contract; module configs in
 * `packages/modules/<id>.ts` extend their own variant when the
 * vertical-specific stories land. Treat this file as the lockable
 * intersection — fields here are guaranteed to exist for every module
 * output.
 */
const baseSlots = {
  title: z.string(),
  summary: z.string(),
  bullets: z.array(analysisBulletSchema).default([]),
};

export const moduleOutputSchema = z.discriminatedUnion('module', [
  z.object({
    module: z.literal('general'),
    ...baseSlots,
  }),
  z.object({
    module: z.literal('sales'),
    ...baseSlots,
    talkRatio: z.object({ self: z.number(), counterpart: z.number() }).optional(),
    objections: z.array(analysisBulletSchema).default([]),
    nextSteps: z.array(analysisBulletSchema).default([]),
    dealRisk: z.enum(['low', 'medium', 'high']).optional(),
  }),
  z.object({
    module: z.literal('hr'),
    ...baseSlots,
    competencies: z.array(analysisBulletSchema).default([]),
  }),
  z.object({
    module: z.literal('education'),
    ...baseSlots,
    engagement: z.array(analysisBulletSchema).default([]),
    objectiveCoverage: z.array(analysisBulletSchema).default([]),
  }),
  z.object({
    module: z.literal('medical'),
    ...baseSlots,
    soap: z
      .object({
        subjective: z.string(),
        objective: z.string(),
        assessment: z.string(),
        plan: z.string(),
      })
      .optional(),
    riskFlags: z.array(analysisBulletSchema).default([]),
  }),
  z.object({
    module: z.literal('support'),
    ...baseSlots,
    resolutionStatus: z.enum(['resolved', 'pending', 'escalated']).optional(),
    escalationFlags: z.array(analysisBulletSchema).default([]),
  }),
  z.object({
    module: z.literal('pm'),
    ...baseSlots,
    decisions: z.array(analysisBulletSchema).default([]),
    actionItems: z.array(analysisBulletSchema).default([]),
    risks: z.array(analysisBulletSchema).default([]),
  }),
  z.object({
    module: z.literal('psychology'),
    ...baseSlots,
    sessionThemes: z.array(analysisBulletSchema).default([]),
    therapeuticAlliance: z.enum(['weak', 'developing', 'strong']).optional(),
  }),
]);

export type ModuleOutput = z.infer<typeof moduleOutputSchema>;

/**
 * Streaming state envelope — the AnalysisCard renders a per-stage skeleton
 * while the worker fills the slots in. The discriminator is independent of
 * the module discriminator above.
 */
export const analysisStateSchema = z.union([
  z.object({ kind: z.literal('streaming'), stageLabel: z.string() }),
  z.object({ kind: z.literal('ready'), output: moduleOutputSchema }),
  z.object({ kind: z.literal('low-confidence'), output: moduleOutputSchema }),
  z.object({
    kind: z.literal('override'),
    output: moduleOutputSchema,
    fromModule: moduleIdSchema,
  }),
  z.object({
    kind: z.literal('failed'),
    reason: z.string(),
    retryable: z.boolean().default(true),
  }),
]);
export type AnalysisState = z.infer<typeof analysisStateSchema>;
