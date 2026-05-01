/**
 * Canonical SSE event registry.
 *
 * Story 3.2 + 3.3 introduce the worker → client streaming events
 * surfaced through the AnalysisCard + capture watchdog. The actual SSE
 * delivery infrastructure (Fastify route + per-tenant fan-out) is owned
 * by Story 3.7 — this file just locks in the event-name union so
 * producers (workers) and consumers (web/mobile + Story 3.7 SSE route)
 * cannot drift.
 *
 * Producers:
 *   - `recording.transcribed`              — apps/workers/src/handlers/transcribe.ts (Story 2.2)
 *   - `meeting.summarized`                 — apps/workers/src/handlers/summarize.ts (Story 3.2, this story)
 *   - `meeting.analyzed`                   — alias of `summarized` while only `general` ships;
 *                                            per-vertical analyzers (Story 5.x) emit this when
 *                                            they post their own `module_outputs` row.
 *   - `meeting.action-items-extracted`     — apps/workers/src/handlers/extract-action-items.ts (Story 3.3, this story)
 *   - `recording.at-risk`                  — apps/workers/src/handlers/recording-watchdog.ts (Story 4.4)
 *   - `recording.upload-failed`            — apps/api/src/routes/recordings.ts on POST /complete failure (future)
 *   - `bot.join-failed`                    — apps/bot or apps/workers (future) when a Zoom/Teams join fails
 *
 * TODO(Story 3.7): wire the Fastify SSE route + per-tenant fan-out.
 * Today this file is contract-only; producers structured-log events
 * with the kind so observability tools can already pick them up.
 */

export const SSE_EVENT_KINDS = [
  'meeting.transcribed',
  'meeting.summarized',
  'meeting.analyzed',
  'meeting.action-items-extracted',
  'recording.at-risk',
  'recording.upload-failed',
  'bot.join-failed',
] as const;

export type SseEventKind = (typeof SSE_EVENT_KINDS)[number];

const SSE_EVENT_KIND_SET: ReadonlySet<string> = new Set(SSE_EVENT_KINDS);

/** Runtime guard — useful for SSE route fan-out filters. */
export const isSseEventKind = (value: string): value is SseEventKind =>
  SSE_EVENT_KIND_SET.has(value);

/**
 * Generic SSE event envelope. The `data` shape is event-specific;
 * Story 3.7 will narrow per-kind via a discriminated union once the
 * client + server consumers land.
 */
export interface SseEvent<TData = unknown> {
  kind: SseEventKind;
  /** Tenant scope — every event is filtered to its tenant's subscribers. */
  tenantId: string;
  /** Resource the event references (meetingId / recordingId). */
  resourceId: string;
  /** Producer-defined payload. */
  data: TData;
  /** Producer-side wall-clock for ordering across retries. */
  emittedAt: string;
}
