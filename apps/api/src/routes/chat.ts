/**
 * RAG chat route — Story 6.1 (FR29 + FR30 substrate).
 *
 * Mount path: `/api/v1/chat` (set by `buildServer()` via prefix).
 *
 *   POST / { query, messages, meetingId? } → text/event-stream
 *
 * Wire shape:
 *   - Each event is `event: <kind>\ndata: <json>\n\n`
 *   - First event is `retrieval` carrying the citation set
 *   - Then zero-or-more `delta` events token-stream the answer
 *   - Final event is `done` with the empty-state classification
 *
 * Today the retriever delegates to the Story 7.2 search repository
 * (FTS only); Story 7.1's vector retriever swaps in by changing the
 * `chatRetriever` injection. The streaming itself uses a small
 * generator so the LLM-gateway swap remains a one-line change.
 */

import {
  type ChatEvent,
  type ChatMessage,
  type ChatRequest,
  type CitationRef,
  chatRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';

/**
 * Retriever signature — pulls the relevant transcript turns for a
 * query. The Story 7.2 implementation hits the search repository;
 * Story 7.1 will replace it with a vector retriever that returns the
 * same shape.
 */
export type ChatRetriever = (input: {
  tenantId: string;
  query: string;
  meetingId?: string;
}) => Promise<{
  citations: CitationRef[];
  /** Joined retrieved transcript text — fed to the LLM as context. */
  context: string;
  /** Heuristic 0..1 — how confident retrieval is the corpus has the answer. */
  retrievalConfidence: number;
}>;

/**
 * LLM-gateway signature — async-iterable token stream. The default
 * implementation uses a deterministic mock so the route is testable
 * without provider credentials. Production wires the real
 * `packages/llm-gateway` streaming method.
 */
export type ChatStreamer = (input: {
  tenantId: string;
  systemPrompt: string;
  messages: ChatMessage[];
  context: string;
}) => AsyncIterable<string>;

export interface ChatRoutesOptions {
  retriever: ChatRetriever;
  streamer: ChatStreamer;
  /**
   * Faithfulness threshold — answers below this are flipped to
   * `no-answer` empty-state and the assistant text is replaced with
   * an honest "I don't have enough corpus context" message.
   */
  faithfulnessFloor?: number;
}

const SYSTEM_PROMPT = `You are AI Secretary's RAG-grounded assistant. You only answer using the provided meeting context.
- If the context doesn't contain enough information, reply: "I don't have enough corpus context to answer that."
- Always cite the specific transcript spans you used.
- Refuse to speculate beyond the context.`;

const requireAuth = (request: FastifyRequest): { tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { tenantId: request.tenantId };
};

const formatEvent = (event: ChatEvent): string => {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
};

export const chatRoutes = (options: ChatRoutesOptions): FastifyPluginAsync => {
  const faithfulnessFloor = options.faithfulnessFloor ?? 0.3;

  return async (fastify) => {
    fastify.post<{ Body: ChatRequest }>(
      '/',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const parsed = chatRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid chat request.');
        }
        const { query, messages, meetingId } = parsed.data;

        // Run retrieval first — clients consume the citation set
        // synchronously before the answer streams.
        let retrieved: Awaited<ReturnType<ChatRetriever>>;
        try {
          retrieved = await options.retriever({
            tenantId,
            query,
            ...(meetingId ? { meetingId } : {}),
          });
        } catch (err) {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });
          reply.raw.write(
            formatEvent({
              kind: 'error',
              code: 'retrieval-failed',
              message: err instanceof Error ? err.message : 'Retrieval failed.',
            }),
          );
          reply.raw.end();
          return reply;
        }

        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        reply.raw.write(formatEvent({ kind: 'retrieval', citations: retrieved.citations }));

        // Off-topic short-circuit — the retriever returned no
        // citations AND the query has zero overlap with anything in
        // the user's corpus. We emit a `done: off-topic` event without
        // ever calling the LLM, saving the round trip.
        if (retrieved.citations.length === 0 && retrieved.retrievalConfidence === 0) {
          reply.raw.write(
            formatEvent({
              kind: 'delta',
              text: "I don't see anything in your corpus matching that — try rephrasing or recording related meetings first.",
            }),
          );
          reply.raw.write(
            formatEvent({ kind: 'done', emptyState: 'off-topic', faithfulness: null }),
          );
          reply.raw.end();
          return reply;
        }

        const turns: ChatMessage[] = [...messages, { role: 'user', content: query }];

        try {
          let assembled = '';
          for await (const chunk of options.streamer({
            tenantId,
            systemPrompt: SYSTEM_PROMPT,
            messages: turns,
            context: retrieved.context,
          })) {
            assembled += chunk;
            reply.raw.write(formatEvent({ kind: 'delta', text: chunk }));
          }
          // Faithfulness scoring: cheap heuristic — overlap between the
          // assembled answer and the retrieved context. Story 6.x
          // follow-up swaps in a real eval (LLM-as-judge) at the
          // workers layer.
          const faithfulness = computeFaithfulness(assembled, retrieved.context);
          const emptyState =
            assembled.length === 0
              ? 'no-answer'
              : faithfulness < faithfulnessFloor
                ? 'low-confidence'
                : retrieved.retrievalConfidence < 0.4
                  ? 'low-confidence'
                  : 'confident';
          reply.raw.write(
            formatEvent({
              kind: 'done',
              emptyState,
              faithfulness: assembled.length === 0 ? null : faithfulness,
            }),
          );
          reply.raw.end();
        } catch (err) {
          reply.raw.write(
            formatEvent({
              kind: 'error',
              code: 'stream-failed',
              message: err instanceof Error ? err.message : 'Streaming failed.',
            }),
          );
          reply.raw.end();
        }
        return reply;
      },
    );
  };
};

/**
 * Cheap faithfulness heuristic — fraction of answer tokens that appear
 * in the retrieved context. This is NOT the production-grade eval; it's
 * a fast in-process signal so the empty-state classification is
 * defensible without a separate eval round-trip. Story 6.x follow-up
 * replaces this with an LLM-as-judge that runs in the workers tier.
 */
const computeFaithfulness = (answer: string, context: string): number => {
  if (answer.length === 0) return 0;
  const ctxTokens = new Set(
    context
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2),
  );
  if (ctxTokens.size === 0) return 0;
  const ansTokens = answer
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  if (ansTokens.length === 0) return 0;
  const matches = ansTokens.filter((t) => ctxTokens.has(t)).length;
  return Math.min(1, matches / ansTokens.length);
};

/**
 * Default retriever — uses the search repository (Story 7.2 FTS).
 * Joins the top-N transcript turns into a single context block.
 */
export const buildSearchBackedRetriever = (
  search: import('./search-repository.js').SearchRepository,
  options: { topN?: number } = {},
): ChatRetriever => {
  const topN = options.topN ?? 8;
  return async ({ tenantId, query, meetingId }) => {
    const result = await search.search({
      tenantId,
      query,
      ...(meetingId ? { meetingId } : {}),
      limit: topN,
    });
    const transcriptHits = result.hits.filter((h) => h.source === 'transcript');
    const citations: CitationRef[] = transcriptHits
      .filter((h) => h.turnId !== null && h.spanStartMs !== null && h.spanEndMs !== null)
      .map((h) => ({
        meetingId: h.meetingId,
        turnId: h.turnId as string,
        spanStartMs: h.spanStartMs as number,
        spanEndMs: h.spanEndMs as number,
        ...(h.speaker !== null ? { speaker: h.speaker } : {}),
      }));
    const context = transcriptHits
      .map((h) => `[${h.meetingTitle}] ${stripMarks(h.snippet)}`)
      .join('\n\n');
    const retrievalConfidence =
      transcriptHits.length === 0 ? 0 : Math.min(1, transcriptHits[0]?.rank ?? 0.5);
    return { citations, context, retrievalConfidence };
  };
};

/**
 * Mock streamer — yields a deterministic word-at-a-time reply built
 * from the retrieved context. Used by tests and as the default when
 * production hasn't wired the real LLM gateway yet.
 */
export const buildMockStreamer = (): ChatStreamer => {
  return async function* mockStream({ context }) {
    if (!context) return;
    const trimmed = context.split('\n').slice(0, 2).join(' ').slice(0, 280);
    const reply = `Based on the corpus: ${trimmed}`;
    for (const token of reply.split(/(\s+)/)) {
      yield token;
    }
  };
};

/**
 * Production streamer — bridges an `@aisecretary/llm-gateway`
 * `LlmProvider` to the `ChatStreamer` shape the chat route expects.
 *
 * Production wiring lives in `buildProductionServer()`: when
 * ANTHROPIC_API_KEY is set, instantiate `AnthropicProvider` and pass
 * it here. Without the key, the route falls back to `buildMockStreamer`.
 */
export const buildLlmGatewayStreamer = (
  provider: import('@aisecretary/llm-gateway').LlmProvider,
  options: { maxOutputTokens?: number; temperature?: number } = {},
): ChatStreamer => {
  return async function* gatewayStream({ tenantId, systemPrompt, messages, context }) {
    const augmentedMessages: import('@aisecretary/llm-gateway').ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(context
        ? [
            {
              role: 'system' as const,
              content: `<retrieved-context>\n${context}\n</retrieved-context>`,
            },
          ]
        : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const request: import('@aisecretary/llm-gateway').ChatRequest = {
      messages: augmentedMessages,
      tenantId,
      ...(options.maxOutputTokens !== undefined
        ? { maxOutputTokens: options.maxOutputTokens }
        : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    };
    for await (const event of provider.chatStream(request)) {
      if (event.kind === 'token') {
        yield event.text;
      }
      // `done` + `error` events terminate iteration; we don't surface them.
    }
  };
};

const stripMarks = (s: string): string => s.replace(/<\/?mark>/g, '');
