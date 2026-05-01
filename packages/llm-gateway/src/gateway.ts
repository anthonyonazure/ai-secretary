import type { z } from 'zod';
import { LlmError, LlmProviderError, LlmRateLimitError, LlmSchemaParseError } from './errors.js';
import {
  type CreateLlmProviderOpts,
  type LlmProviderConfigs,
  createLlmProvider,
} from './factory.js';
import { type TenantLlmContext, selectProviderKindForTenant } from './selector.js';
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  LlmProvider,
  LlmProviderKind,
} from './types.js';

/**
 * Audit-logger injection point. The gateway calls `log()` once per
 * `chat()` outcome (success OR final failure) with the resolved
 * provider kind + token counts + finish reason.
 *
 * TODO(Story 1.4): once the audit-logger plugin lands in apps/api, the
 * shape here merges into the canonical `apps/api/src/lib/audit-types.ts`
 * union. Until then, this is the contract — consumers (workers + API
 * route handlers) wire whichever impl they have on hand.
 */
export interface LlmAuditEntry {
  tenantId: string;
  providerKind: LlmProviderKind;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
  /** True when this call exhausted the primary and fell back. */
  fellBack: boolean;
}

export interface LlmAuditLogger {
  log(entry: LlmAuditEntry): Promise<void>;
}

/** No-op audit logger used by default and in tests. */
export const noopLlmAuditLogger: LlmAuditLogger = {
  async log() {
    // intentionally blank
  },
};

export interface LlmGatewayDeps {
  /** Per-tenant routing context — drives the selector. */
  tenant: TenantLlmContext;
  /** Provider creds + endpoints. Missing keys = that provider is unavailable. */
  configs: LlmProviderConfigs;
  /** When true, retryable errors fall through to the next kind in the preference list. */
  enableFallback?: boolean;
  /** Audit hook — called once per chat completion. */
  auditLogger?: LlmAuditLogger;
  /**
   * Optional override of the factory — primarily for tests that want
   * to inject deterministic providers without going through the
   * `configs.mock` path.
   */
  createProvider?: (opts: CreateLlmProviderOpts) => LlmProvider;
}

/**
 * `LlmGateway` — top-level orchestrator.
 *
 * Responsibilities:
 *   1. Resolve the per-tenant provider preference list via the selector.
 *   2. Instantiate the primary provider via the factory.
 *   3. Call `provider.chat(...)` (or `chatStream`).
 *   4. On retryable error AND `enableFallback`, advance to the next
 *      kind in the list and retry. Non-retryable errors surface
 *      immediately.
 *   5. When `responseSchema` is set, zod-parse `response.text` and on
 *      parse failure retry ONCE with an injected system message that
 *      asks the model to emit valid JSON matching the requested shape.
 *      A second parse failure throws `LlmSchemaParseError`.
 *   6. Emit an audit-log entry with the resolved provider kind +
 *      token counts + finish reason + whether we fell back.
 */
export class LlmGateway {
  private readonly auditLogger: LlmAuditLogger;
  private readonly factory: (opts: CreateLlmProviderOpts) => LlmProvider;

  constructor(private readonly deps: LlmGatewayDeps) {
    this.auditLogger = deps.auditLogger ?? noopLlmAuditLogger;
    this.factory = deps.createProvider ?? createLlmProvider;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const preference = selectProviderKindForTenant(this.deps.tenant);
    const order: LlmProviderKind[] = this.deps.enableFallback
      ? [preference.primary, ...preference.fallbacks]
      : [preference.primary];

    let lastError: unknown;
    for (let i = 0; i < order.length; i += 1) {
      const kind = order[i];
      if (kind === undefined) continue;
      const fellBack = i > 0;
      let provider: LlmProvider;
      try {
        provider = this.factory({ kind, configs: this.deps.configs });
      } catch (err) {
        // Missing config for this kind — try the next.
        lastError = err;
        if (this.deps.enableFallback === true) continue;
        throw err;
      }

      try {
        const response = await this.invokeWithSchema(provider, input);
        await this.auditLogger.log({
          tenantId: input.tenantId,
          providerKind: provider.kind,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          finishReason: response.finishReason,
          fellBack,
        });
        return response;
      } catch (err) {
        lastError = err;
        if (this.deps.enableFallback === true && this.isRetryable(err)) {
          continue;
        }
        // Audit the terminal failure so the run is still observable.
        await this.auditLogger.log({
          tenantId: input.tenantId,
          providerKind: provider.kind,
          inputTokens: 0,
          outputTokens: 0,
          finishReason: 'error',
          fellBack,
        });
        throw err;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new LlmError('LlmGateway: no provider available');
  }

  /**
   * Streaming variant. Does NOT do schema-parse retry — callers that
   * need structured output must use `chat()`. Fallback semantics on
   * non-stream initial failures match `chat()`; once the stream starts
   * yielding tokens we don't fall back mid-stream (the partial output
   * has already been delivered to the caller).
   */
  async *chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const preference = selectProviderKindForTenant(this.deps.tenant);
    const order: LlmProviderKind[] = this.deps.enableFallback
      ? [preference.primary, ...preference.fallbacks]
      : [preference.primary];

    for (let i = 0; i < order.length; i += 1) {
      const kind = order[i];
      if (kind === undefined) continue;
      const fellBack = i > 0;
      let provider: LlmProvider;
      try {
        provider = this.factory({ kind, configs: this.deps.configs });
      } catch (err) {
        if (this.deps.enableFallback === true) continue;
        const message = err instanceof Error ? err.message : String(err);
        yield { kind: 'error', error: message };
        return;
      }

      // Materialize the stream into events — first event decides whether
      // we accept this provider's stream or try the next.
      const iterator = provider.chatStream(input)[Symbol.asyncIterator]();
      const first = await iterator.next();
      if (first.done) {
        // Empty stream — treat as terminal error and try fallback.
        if (this.deps.enableFallback === true) continue;
        yield { kind: 'error', error: '[gateway] provider produced empty stream' };
        return;
      }
      const firstEvent = first.value;
      // If the very first event is `error`, fall back if enabled.
      if (firstEvent.kind === 'error' && this.deps.enableFallback === true) {
        continue;
      }
      yield firstEvent;
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason = 'unknown';
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const evt = next.value;
        if (evt.kind === 'done') {
          inputTokens = evt.inputTokens;
          outputTokens = evt.outputTokens;
          finishReason = evt.finishReason;
        }
        yield evt;
      }
      await this.auditLogger.log({
        tenantId: input.tenantId,
        providerKind: provider.kind,
        inputTokens,
        outputTokens,
        finishReason,
        fellBack,
      });
      return;
    }
    yield { kind: 'error', error: '[gateway] no provider available' };
  }

  /** Invoke `provider.chat()` and apply the schema-parse retry policy. */
  private async invokeWithSchema(provider: LlmProvider, input: ChatRequest): Promise<ChatResponse> {
    if (input.responseSchema === undefined) {
      return await provider.chat(input);
    }

    const schema = input.responseSchema;
    const first = await provider.chat({
      ...input,
      messages: [
        ...input.messages,
        {
          role: 'system',
          content:
            'Respond with valid JSON only. Do not include markdown fences, prose, or explanation. The JSON must match the agreed-upon schema exactly.',
        },
      ],
    });
    const firstParse = tryParseSchema(schema, first.text);
    if (firstParse.ok) {
      return { ...first, parsed: firstParse.value };
    }

    // One-shot retry — feed the bad output + the parse error back to the
    // model with a fix-the-shape system message.
    const second = await provider.chat({
      ...input,
      messages: [
        ...input.messages,
        { role: 'assistant', content: first.text },
        {
          role: 'system',
          content: `Your previous response was not valid JSON or did not match the required schema. Error: ${firstParse.error}. Reply now with valid JSON only — no markdown fences, no prose.`,
        },
      ],
    });
    const secondParse = tryParseSchema(schema, second.text);
    if (secondParse.ok) {
      return { ...second, parsed: secondParse.value };
    }
    throw new LlmSchemaParseError(
      `LLM response failed schema parse twice: ${secondParse.error}`,
      second.text,
    );
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof LlmRateLimitError) return true;
    if (err instanceof LlmProviderError) return err.retryable;
    return false;
  }
}

const tryParseSchema = (
  schema: z.ZodSchema,
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } => {
  // Strip an optional ```json ... ``` fence the model may have wrapped
  // around the payload despite the system prompt asking it not to.
  const stripped = stripJsonFence(text).trim();
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    return { ok: false, error: `JSON.parse failed: ${(err as Error).message}` };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, value: parsed.data };
};

const stripJsonFence = (text: string): string => {
  const fence = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/;
  const match = text.match(fence);
  return match?.[1] ?? text;
};
