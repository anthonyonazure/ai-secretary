import OpenAI from 'openai';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError } from './errors.js';
import {
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type FinishReason,
  type LlmProvider,
} from './types.js';

/**
 * Direct-OpenAI provider (ZDR addendum).
 *
 * The `openai` package is shared with `packages/transcription` — it's
 * imported in BOTH packages and the provider-isolation grep allows it
 * in either. No other workspace package may import `openai` directly.
 *
 * Used as the fallback path for non-regulated US tenants when Anthropic
 * is unavailable. NEVER used for HIPAA tenants — direct OpenAI does
 * not sign BAAs (that's Azure OpenAI's HIPAA-eligible tier).
 */

const DEFAULT_MODEL = 'gpt-4o';

export interface OpenAiProviderConfig {
  apiKey: string;
  /** Override the model — defaults to `gpt-4o`. */
  model?: string;
  /** Override the per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  /** Pre-built client (tests). When provided, `apiKey` is ignored. */
  client?: OpenAI;
}

const mapFinishReason = (raw: string | null | undefined): FinishReason => {
  switch (raw) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool-use';
    default:
      return 'unknown';
  }
};

/** Map an SDK exception to our typed hierarchy. */
const wrapOpenAiError = (
  err: unknown,
  providerKind: 'openai' | 'azure-openai',
  signalAborted: boolean,
  timeoutMs: number,
): Error => {
  if (signalAborted) return new LlmTimeoutError(timeoutMs, err);
  const e = err as {
    status?: number;
    message?: string;
    headers?: Record<string, string> | undefined;
    request_id?: string;
  };
  const status = typeof e.status === 'number' ? e.status : undefined;
  const message = typeof e.message === 'string' ? e.message : String(err);
  const requestId =
    typeof e.request_id === 'string'
      ? e.request_id
      : e.headers && typeof e.headers['x-request-id'] === 'string'
        ? e.headers['x-request-id']
        : undefined;

  if (status === 429) {
    const retryAfterRaw = e.headers?.['retry-after'];
    const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined;
    return new LlmRateLimitError(
      providerKind,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
      err,
    );
  }
  const retryable = status === undefined || status >= 500;
  return new LlmProviderError(providerKind, message, retryable, requestId, err);
};

/** Convert ChatRequest messages to OpenAI chat.completions format. */
const toOpenAiMessages = (
  input: ChatRequest,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> => {
  return input.messages.map((m) => ({ role: m.role, content: m.content }));
};

export class OpenAiProvider implements LlmProvider {
  readonly kind: 'openai' | 'azure-openai' = 'openai';
  protected readonly client: OpenAI;
  protected readonly model: string;
  protected readonly timeoutMs: number;

  constructor(config: OpenAiProviderConfig) {
    this.client = config.client ?? new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: toOpenAiMessages(input),
          max_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        },
        { signal: controller.signal },
      );

      const choice = completion.choices[0];
      const text = choice?.message?.content ?? '';
      return {
        text,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        finishReason: mapFinishReason(choice?.finish_reason),
      };
    } catch (err) {
      throw wrapOpenAiError(err, this.kind, controller.signal.aborted, this.timeoutMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  async *chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let outputTokens = 0;
    let inputTokens = 0;
    let finishReason: FinishReason = 'unknown';

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: toOpenAiMessages(input),
          max_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: controller.signal },
      );

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta?.content ?? '';
        if (delta.length > 0) {
          yield { kind: 'token', text: delta };
        }
        if (choice?.finish_reason) {
          finishReason = mapFinishReason(choice.finish_reason);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }
      }
      yield { kind: 'done', inputTokens, outputTokens, finishReason };
    } catch (err) {
      const wrapped = wrapOpenAiError(err, this.kind, controller.signal.aborted, this.timeoutMs);
      yield { kind: 'error', error: wrapped.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
