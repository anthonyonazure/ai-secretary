/**
 * Summarize reader — Story 3.2 + 3.3.
 *
 * Walks meetings + speaker_turns from inside the parent
 * `withJobContext({ tenantId, region })` so RLS is in effect. Returns
 * plain objects suitable for prompt construction; no Drizzle types
 * leak past this boundary.
 *
 * Reuses the shared compliance-posture/region pull from `tenants` so
 * the summarize + extract-action-items handlers can build their LLM
 * gateway with the right routing context per call.
 */

import type { Db } from '@aisecretary/db';
import { meetings, speakerTurns, tenants } from '@aisecretary/db/schema';
import { and, asc, eq } from 'drizzle-orm';

export interface MeetingForAnalysis {
  id: string;
  tenantId: string;
  title: string;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface SpeakerTurnForAnalysis {
  turnId: string;
  speaker: string | null;
  spanStartMs: number;
  spanEndMs: number;
  text: string;
  sequence: number;
}

export interface MeetingWithTurns {
  meeting: MeetingForAnalysis;
  turns: SpeakerTurnForAnalysis[];
}

export interface TenantForAnalysis {
  id: string;
  region: 'us' | 'eu';
  compliancePosture: {
    hipaa?: boolean;
    bookGdpr?: boolean;
    customManagedKeys?: boolean;
    allowedLlmProviders?: ReadonlyArray<
      'anthropic' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama'
    >;
  };
}

export interface SummarizeReader {
  readMeetingWithTurns(meetingId: string, tenantId: string): Promise<MeetingWithTurns | null>;
  findTenantById(tenantId: string): Promise<TenantForAnalysis | null>;
}

export class DrizzleSummarizeReader implements SummarizeReader {
  constructor(private readonly db: Db) {}

  async readMeetingWithTurns(
    meetingId: string,
    tenantId: string,
  ): Promise<MeetingWithTurns | null> {
    const meetingRows = await this.db
      .select({
        id: meetings.id,
        tenantId: meetings.tenantId,
        title: meetings.title,
        startedAt: meetings.startedAt,
        endedAt: meetings.endedAt,
      })
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.tenantId, tenantId)))
      .limit(1);

    const meeting = meetingRows[0];
    if (!meeting) return null;

    const turnRows = await this.db
      .select({
        turnId: speakerTurns.turnId,
        speaker: speakerTurns.speaker,
        spanStartMs: speakerTurns.spanStartMs,
        spanEndMs: speakerTurns.spanEndMs,
        text: speakerTurns.text,
        sequence: speakerTurns.sequence,
      })
      .from(speakerTurns)
      .where(and(eq(speakerTurns.tenantId, tenantId), eq(speakerTurns.meetingId, meetingId)))
      .orderBy(asc(speakerTurns.sequence));

    return {
      meeting,
      turns: turnRows,
    };
  }

  async findTenantById(tenantId: string): Promise<TenantForAnalysis | null> {
    const rows = await this.db
      .select({
        id: tenants.id,
        region: tenants.region,
        compliancePosture: tenants.compliancePosture,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      region: row.region,
      compliancePosture: row.compliancePosture ?? {},
    };
  }
}

/**
 * Format a transcript for an LLM prompt. Each turn is rendered as a
 * single line carrying everything the model needs to cite the span:
 *
 *   [turnId=<hash> seq=<N> start=<ms> end=<ms> speaker=<label|null>] <text>
 *
 * The model is instructed (in each module's system prompt) to copy the
 * `turnId`, `start`, and `end` values verbatim into citation refs.
 * Lines are newline-separated; long meetings are NOT chunked here —
 * Story 5.x adds chunking when token budgets become a real concern.
 */
export const formatTranscriptForLlm = (args: {
  meetingId: string;
  startedAt: Date | null;
  turns: ReadonlyArray<SpeakerTurnForAnalysis>;
}): string => {
  const header = `MEETING_ID: ${args.meetingId}\n${
    args.startedAt ? `STARTED_AT: ${args.startedAt.toISOString()}` : 'STARTED_AT: unknown'
  }\n\nTRANSCRIPT:\n`;
  if (args.turns.length === 0) {
    return `${header}(empty transcript — no speaker turns)`;
  }
  const body = args.turns
    .map((t) => {
      const speaker = t.speaker ?? 'null';
      return `[turnId=${t.turnId} seq=${t.sequence} start=${t.spanStartMs} end=${t.spanEndMs} speaker=${speaker}] ${t.text}`;
    })
    .join('\n');
  return `${header}${body}`;
};
