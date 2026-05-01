/**
 * `meeting.action-items` queue handler — Story 3.3.
 *
 * Mirrors `summarize.ts` shape but with a tighter LLM prompt focused on
 * explicit, agreed-upon commitments. Emits rows into the dedicated
 * `action_items` table (NOT into `module_outputs.actionItems`) so
 * downstream consumers (PM-vertical AnalysisCard, web/mobile lists,
 * push-to-CRM) can read a flat list without reverse-walking the
 * AnalysisCard payload.
 *
 * Idempotency: the handler is NOT idempotent today — re-firing the job
 * appends new rows. Story 5.x adds a re-run flow that deletes existing
 * rows for the (meeting, kind='action-items') tuple before re-inserting;
 * for the MVP path we accept the dup risk and rely on pg-boss not
 * re-firing successful jobs.
 *
 * Worker-side audit: `meeting.action-items-extracted` (logger-only
 * until the worker-side audit-logger plugin lands).
 */

import type { Db, Region } from '@aisecretary/db';
import { actionItems } from '@aisecretary/db/schema';
import {
  type LlmAuditLogger,
  LlmGateway,
  type LlmProviderConfigs,
  type TenantLlmContext,
} from '@aisecretary/llm-gateway';
import { actionItemsModule, actionItemsOutputSchema } from '@aisecretary/modules';
import type pino from 'pino';
import { z } from 'zod';
import { withJobContext } from '../lib/job-context.js';
import { type SummarizeReader, formatTranscriptForLlm } from './summarize-reader.js';

export const ACTION_ITEMS_QUEUE = 'meeting.action-items' as const;

export const actionItemsJobPayloadSchema = z.object({
  meetingId: z.string().uuid(),
  tenantId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type ActionItemsJobPayload = z.infer<typeof actionItemsJobPayloadSchema>;

export interface ActionItemsJob {
  data: ActionItemsJobPayload;
}

export type ActionItemsGatewayFactory = (args: {
  tenant: TenantLlmContext;
  configs: LlmProviderConfigs;
  enableFallback: boolean;
  auditLogger?: LlmAuditLogger;
}) => Pick<LlmGateway, 'chat'>;

export interface ExtractActionItemsHandlerDeps {
  db: Db;
  logger: pino.Logger;
  summarizeReader: SummarizeReader;
  llmConfigs: LlmProviderConfigs;
  gatewayFactory?: ActionItemsGatewayFactory;
}

const defaultGatewayFactory: ActionItemsGatewayFactory = (args) =>
  new LlmGateway({
    tenant: args.tenant,
    configs: args.configs,
    enableFallback: args.enableFallback,
    ...(args.auditLogger ? { auditLogger: args.auditLogger } : {}),
  });

const computeConfidence = (args: {
  finishReason: string;
  itemCount: number;
  itemsWithCitations: number;
}): number => {
  let score = args.finishReason === 'stop' ? 0.85 : 0.5;
  if (args.itemCount === 0) {
    // Empty-meeting path — confidence in the *absence* of items is
    // bounded by the finish reason; a clean stop on empty input is
    // perfectly valid.
    return score;
  }
  if (args.itemsWithCitations === 0) score -= 0.3;
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
};

export const createExtractActionItemsHandler = (deps: ExtractActionItemsHandlerDeps) => {
  const gatewayFactory = deps.gatewayFactory ?? defaultGatewayFactory;

  return async (job: ActionItemsJob): Promise<void> => {
    const parsed = actionItemsJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      deps.logger.error({ issues: parsed.error.issues }, 'action-items: invalid payload');
      throw new Error('action-items: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };

    deps.logger.info(
      { meetingId: data.meetingId, tenantId: data.tenantId, region: data.region },
      'action-items: started',
    );

    await withJobContext(deps.db, ctx, async (tx) => {
      const meetingData = await deps.summarizeReader.readMeetingWithTurns(
        data.meetingId,
        data.tenantId,
      );
      if (!meetingData) {
        throw new Error(`action-items: meeting not found: ${data.meetingId}`);
      }

      const tenant = await deps.summarizeReader.findTenantById(data.tenantId);
      if (!tenant) {
        throw new Error(`action-items: tenant not found: ${data.tenantId}`);
      }
      if (tenant.region !== data.region) {
        throw new Error(
          `action-items: region mismatch: tenant=${tenant.region} job=${data.region}`,
        );
      }

      const gateway = gatewayFactory({
        tenant: {
          region: tenant.region,
          compliancePosture: tenant.compliancePosture,
        },
        configs: deps.llmConfigs,
        enableFallback: true,
      });

      const userContent = formatTranscriptForLlm({
        meetingId: meetingData.meeting.id,
        startedAt: meetingData.meeting.startedAt,
        turns: meetingData.turns,
      });

      const response = await gateway.chat({
        tenantId: data.tenantId,
        messages: [
          { role: 'system', content: actionItemsModule.systemPrompt },
          { role: 'user', content: userContent },
        ],
        responseSchema: actionItemsModule.outputSchema,
        maxOutputTokens: actionItemsModule.maxOutputTokens,
        temperature: actionItemsModule.temperature,
      });

      // Defensive re-parse — `response.parsed` is `unknown` per the
      // gateway typing, so we narrow with the schema again.
      const parsedOutputResult = actionItemsOutputSchema.safeParse(response.parsed);
      if (!parsedOutputResult.success) {
        throw new Error(
          `action-items: parsed output did not match schema: ${parsedOutputResult.error.message}`,
        );
      }
      const parsedOutput = parsedOutputResult.data;

      const itemCount = parsedOutput.items.length;
      const itemsWithCitations = parsedOutput.items.filter((i) => i.citations.length > 0).length;
      const confidence = computeConfidence({
        finishReason: response.finishReason,
        itemCount,
        itemsWithCitations,
      });

      // Insert rows. We do not resolve `ownerName` → `owner_user_id`
      // here — name-matching against tenant members is Story 5.x scope
      // (pulls in the directory + permission model). For the MVP we
      // persist the free-text owner_name and leave the FK null.
      if (itemCount > 0) {
        const now = new Date();
        const rows = parsedOutput.items.map((item) => ({
          tenantId: data.tenantId,
          meetingId: data.meetingId,
          ownerUserId: null,
          ownerName: item.ownerName,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          text: item.text,
          status: 'pending' as const,
          confidence: confidence.toFixed(3),
          citations: item.citations as unknown as Array<Record<string, unknown>>,
          createdAt: now,
          updatedAt: now,
        }));
        await tx.insert(actionItems).values(rows);
      }

      deps.logger.info(
        {
          sseEvent: {
            kind: 'meeting.action-items-extracted',
            tenantId: data.tenantId,
            resourceId: data.meetingId,
            data: { itemCount, confidence },
          },
          audit: {
            action: 'meeting.action-items-extracted',
            tenantId: data.tenantId,
            meetingId: data.meetingId,
            itemCount,
          },
        },
        'action-items: emitted',
      );
    });

    deps.logger.info({ meetingId: data.meetingId }, 'action-items: completed');
  };
};
