/**
 * `meeting.summarize` queue handler — Story 3.2.
 *
 * Pipeline (mirrors transcribe.ts pattern):
 *   1. Validate payload (zod).
 *   2. Inside `withJobContext({ tenantId, region })`:
 *      a. Read meeting + ordered speaker_turns via the injected reader.
 *      b. Read tenant compliance posture + region (sanity-check region).
 *      c. Construct an `LlmGateway` with the tenant's posture + the
 *         configured provider creds. Schema-parse retry inside the
 *         gateway runs against the `general` module's `outputSchema`.
 *      d. Build the ChatRequest from the `general` module config:
 *         system prompt + transcript-formatted user message.
 *      e. Call `gateway.chat()`. The `parsed` field of the response is
 *         the typed `GeneralModuleOutput`.
 *      f. Compute MVP confidence heuristic.
 *      g. UPSERT a `module_outputs` row keyed on `(meeting_id, 'general')`.
 *      h. Emit a structured-log SSE event marker (`meeting.summarized`
 *         + `meeting.analyzed`) — Story 3.7 will pick these up off the
 *         worker's audit/event stream and fan them out over SSE.
 *      i. Audit `meeting.summarized` + `meeting.analyzed` (logger-only
 *         until the worker-side audit-logger lands; mirrors the pattern
 *         in dsar-export.ts + transcribe.ts).
 *   3. On any error: structured-log + rethrow. pg-boss handles the
 *      retry/backoff (no in-handler retry loop).
 *
 * This handler is co-enqueued by `transcribe.ts` on its happy path
 * (via the `AnalysisEnqueuer` injection point) so the AnalysisCard
 * shows a result without a manual trigger.
 *
 * Confidence heuristic (MVP):
 *   - Base: 0.85 if `finishReason === 'stop'`, else 0.50.
 *   - Bonus: +0.05 when `inputTokens > 500` (longer transcript = more signal).
 *   - Penalty: -0.20 when no bullets carried any citation (the prompt
 *     requires citations; missing is a strong "weak output" signal).
 *   - Clamped to [0, 1].
 *   - Story 3.6 will replace this with a citation-required CI gate +
 *     more sophisticated scoring; this is intentionally simple so the
 *     UPSERT path can land first.
 */

import type { Db, Region } from '@aisecretary/db';
import { moduleOutputs } from '@aisecretary/db/schema';
import {
  type LlmAuditLogger,
  LlmGateway,
  type LlmProviderConfigs,
  type TenantLlmContext,
} from '@aisecretary/llm-gateway';
import { generalModule } from '@aisecretary/modules';
import type pino from 'pino';
import { z } from 'zod';
import { withJobContext } from '../lib/job-context.js';
import {
  type MeetingWithTurns,
  type SummarizeReader,
  type TenantForAnalysis,
  formatTranscriptForLlm,
} from './summarize-reader.js';

export const SUMMARIZE_QUEUE = 'meeting.summarize' as const;

export const summarizeJobPayloadSchema = z.object({
  meetingId: z.string().uuid(),
  tenantId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type SummarizeJobPayload = z.infer<typeof summarizeJobPayloadSchema>;

export interface SummarizeJob {
  data: SummarizeJobPayload;
}

/**
 * Gateway factory — defaulted to `(deps) => new LlmGateway(deps)` in
 * production. Tests inject a builder that returns a gateway wired
 * around a `MockLlmProvider`.
 */
export type SummarizeGatewayFactory = (args: {
  tenant: TenantLlmContext;
  configs: LlmProviderConfigs;
  enableFallback: boolean;
  auditLogger?: LlmAuditLogger;
}) => Pick<LlmGateway, 'chat'>;

export interface SummarizeHandlerDeps {
  db: Db;
  logger: pino.Logger;
  summarizeReader: SummarizeReader;
  /**
   * LLM provider configs — the gateway's selector picks a provider
   * kind from the tenant context, then the factory resolves creds
   * from this object. Missing creds for a kind = that kind is skipped
   * (gateway falls through to the next when `enableFallback`).
   */
  llmConfigs: LlmProviderConfigs;
  /** Optional override of the gateway constructor — tests inject a fake. */
  gatewayFactory?: SummarizeGatewayFactory;
}

const defaultGatewayFactory: SummarizeGatewayFactory = (args) =>
  new LlmGateway({
    tenant: args.tenant,
    configs: args.configs,
    enableFallback: args.enableFallback,
    ...(args.auditLogger ? { auditLogger: args.auditLogger } : {}),
  });

const computeConfidence = (args: {
  finishReason: string;
  inputTokens: number;
  bulletCount: number;
  bulletsWithCitations: number;
}): number => {
  let score = args.finishReason === 'stop' ? 0.85 : 0.5;
  if (args.inputTokens > 500) score += 0.05;
  if (args.bulletCount > 0 && args.bulletsWithCitations === 0) {
    score -= 0.2;
  }
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
};

export const createSummarizeHandler = (deps: SummarizeHandlerDeps) => {
  const gatewayFactory = deps.gatewayFactory ?? defaultGatewayFactory;

  return async (job: SummarizeJob): Promise<void> => {
    const parsed = summarizeJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      deps.logger.error({ issues: parsed.error.issues }, 'summarize: invalid payload');
      throw new Error('summarize: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };

    deps.logger.info(
      { meetingId: data.meetingId, tenantId: data.tenantId, region: data.region },
      'summarize: started',
    );

    await withJobContext(deps.db, ctx, async (tx) => {
      // 2a. Read meeting + speaker_turns.
      const data2: MeetingWithTurns | null = await deps.summarizeReader.readMeetingWithTurns(
        data.meetingId,
        data.tenantId,
      );
      if (!data2) {
        throw new Error(`summarize: meeting not found: ${data.meetingId}`);
      }

      // 2b. Tenant compliance posture + region check.
      const tenant: TenantForAnalysis | null = await deps.summarizeReader.findTenantById(
        data.tenantId,
      );
      if (!tenant) {
        throw new Error(`summarize: tenant not found: ${data.tenantId}`);
      }
      if (tenant.region !== data.region) {
        throw new Error(`summarize: region mismatch: tenant=${tenant.region} job=${data.region}`);
      }

      // 2c. Build the gateway per tenant.
      const gateway = gatewayFactory({
        tenant: {
          region: tenant.region,
          compliancePosture: tenant.compliancePosture,
        },
        configs: deps.llmConfigs,
        enableFallback: true,
      });

      // 2d. Compose the ChatRequest from the general module.
      const userContent = formatTranscriptForLlm({
        meetingId: data2.meeting.id,
        startedAt: data2.meeting.startedAt,
        turns: data2.turns,
      });

      // 2e. Call the LLM — schema-parse retry happens inside the gateway.
      const response = await gateway.chat({
        tenantId: data.tenantId,
        messages: [
          { role: 'system', content: generalModule.systemPrompt },
          { role: 'user', content: userContent },
        ],
        responseSchema: generalModule.outputSchema,
        maxOutputTokens: generalModule.maxOutputTokens,
        temperature: generalModule.temperature,
      });

      const parsedOutput = response.parsed as
        | {
            module: 'general';
            title: string;
            summary: string;
            bullets: Array<{ citations: unknown[] }>;
          }
        | undefined;
      if (!parsedOutput || parsedOutput.module !== 'general') {
        throw new Error('summarize: gateway returned no parsed output');
      }

      // 2f. Confidence heuristic.
      const bulletCount = parsedOutput.bullets.length;
      const bulletsWithCitations = parsedOutput.bullets.filter(
        (b) => Array.isArray(b.citations) && b.citations.length > 0,
      ).length;
      const confidence = computeConfidence({
        finishReason: response.finishReason,
        inputTokens: response.inputTokens,
        bulletCount,
        bulletsWithCitations,
      });

      // 2g. UPSERT the module_outputs row.
      // Drizzle's onConflictDoUpdate keyed on (meeting_id, module_id).
      await tx
        .insert(moduleOutputs)
        .values({
          tenantId: data.tenantId,
          meetingId: data.meetingId,
          moduleId: 'general',
          output: parsedOutput as unknown as Record<string, unknown>,
          confidence: confidence.toFixed(3),
          providerKind: null,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [moduleOutputs.meetingId, moduleOutputs.moduleId],
          set: {
            output: parsedOutput as unknown as Record<string, unknown>,
            confidence: confidence.toFixed(3),
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            generatedAt: new Date(),
          },
        });

      // 2h + 2i. Structured-log the SSE event + audit. Real SSE fan-out
      // is Story 3.7; the worker-side audit-logger arrives in Story 1.4
      // follow-up. For now we structured-log so observability tooling
      // can extract everything downstream.
      deps.logger.info(
        {
          sseEvent: {
            kind: 'meeting.summarized',
            tenantId: data.tenantId,
            resourceId: data.meetingId,
            data: {
              moduleId: 'general',
              confidence,
              bulletCount,
              lowConfidence: confidence < generalModule.lowConfidenceThreshold,
            },
          },
          audit: {
            action: 'meeting.summarized',
            tenantId: data.tenantId,
            meetingId: data.meetingId,
            providerKind: response.finishReason,
          },
        },
        'summarize: emitted module_output',
      );
      // Story 5.x will emit a per-vertical `meeting.analyzed` from each
      // vertical analyzer. For Story 3.2 the general analyzer doubles
      // as the "analyzed" producer so the AnalysisCard sees a non-stale
      // ready state.
      deps.logger.info(
        {
          sseEvent: {
            kind: 'meeting.analyzed',
            tenantId: data.tenantId,
            resourceId: data.meetingId,
            data: { moduleId: 'general', confidence },
          },
          audit: {
            action: 'meeting.analyzed',
            tenantId: data.tenantId,
            meetingId: data.meetingId,
          },
        },
        'summarize: emitted analyzed event',
      );
    });

    deps.logger.info({ meetingId: data.meetingId }, 'summarize: completed');
  };
};
