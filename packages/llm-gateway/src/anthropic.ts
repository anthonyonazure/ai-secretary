import Anthropic from '@anthropic-ai/sdk';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError } from './errors.js';
import {
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type FinishReason,
  type LlmProvider,
} from './types.js';

/**
 * Direct-Anthropic provider.
 *
 * This is the ONLY file in the workspace allowed to import the
 * `@anthropic-ai/sdk` package. The provider-isolation grep
 * (`scripts/check-isolation.ts`) enforces this.
 *
 * Used as the default for non-regulated US tenants. HIPAA / EU tenants
 * route through `AnthropicBedrockProvider` instead — same model family,
 * different compliance + residency posture.
 */

const PROVIDER_KIND = 'anthropic' as const;
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export interface AnthropicProviderConfig {
  apiKey: string;
  /** Override the model — defaults to `claude-sonnet-4-5`. */
  model?: string;
  /** Override the per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  /** Pre-built client (tests). When provided, `apiKey` is ignored. */
  client?: Anthropic;
}

interface AnthropicMessageBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content: AnthropicMessageBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const splitSystemMessages = (
  messages: ChatMessage[],
): {
  system: string | undefined;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
} => {
  const systemParts: string[] = [];
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      conversation.push({ role: msg.role, content: msg.content });
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    conversation,
  };
};

const mapStopReason = (raw: string | null | undefined): FinishReason => {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool-use';
    case null:
    case undefined:
      return 'unknown';
    default:
      return 'unknown';
  }
};

const extractText = (blocks: AnthropicMessageBlock[]): string => {
  return blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text ?? '')
    .join('');
};

/** Map an SDK exception to our typed hierarchy. */
const wrapError = (err: unknown, signalAborted: boolean, timeoutMs: number): Error => {
  if (signalAborted) return new LlmTimeoutError(timeoutMs, err);
  // Anthropic SDK errors expose `status` + `message` + `headers` on subclasses.
  const e = err as {
    status?: number;
    message?: string;
    headers?: Record<string, string> | undefined;
  };
  const status = typeof e.status === 'number' ? e.status : undefined;
  const message = typeof e.message === 'string' ? e.message : String(err);
  const requestId =
    e.headers && typeof e.headers['request-id'] === 'string' ? e.headers['request-id'] : undefined;

  if (status === 429) {
    const retryAfterRaw = e.headers?.['retry-after'];
    const retryAfter = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined;
    return new LlmRateLimitError(
      PROVIDER_KIND,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
      err,
    );
  }
  // 5xx + network = retryable; 4xx (auth, validation) = non-retryable.
  const retryable = status === undefined || status >= 500;
  return new LlmProviderError(PROVIDER_KIND, message, retryable, requestId, err);
};

export class AnthropicProvider implements LlmProvider {
  readonly kind = PROVIDER_KIND;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: AnthropicProviderConfig) {
    this.client = config.client ?? new Anthropic({ apiKey: config.apiKey });
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
      const { system, conversation } = splitSystemMessages(input.messages);
      const response = (await this.client.messages.create(
        {
          model: this.model,
          max_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
          ...(system !== undefined ? { system } : {}),
          messages: conversation,
        },
        { signal: controller.signal },
      )) as unknown as AnthropicMessageResponse;

      return {
        text: extractText(response.content),
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        finishReason: mapStopReason(response.stop_reason),
      };
    } catch (err) {
      throw wrapError(err, controller.signal.aborted, this.timeoutMs);
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

    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: FinishReason = 'unknown';

    try {
      const { system, conversation } = splitSystemMessages(input.messages);
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
          ...(system !== undefined ? { system } : {}),
          messages: conversation,
        },
        { signal: controller.signal },
      );

      // Iterate over MessageStream events. The SDK's stream emits typed
      // events; we only forward `content_block_delta` (text) and tally
      // tokens from `message_start` / `message_delta`.
      const events = stream as AsyncIterable<unknown>;
      for await (const evt of events) {
        const e = evt as {
          type?: string;
          delta?: { type?: string; text?: string; stop_reason?: string };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?: { output_tokens?: number };
        };
        if (e.type === 'message_start' && e.message?.usage) {
          inputTokens = e.message.usage.input_tokens ?? 0;
          outputTokens = e.message.usage.output_tokens ?? 0;
        } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
          const text = e.delta.text ?? '';
          if (text.length > 0) yield { kind: 'token', text };
        } else if (e.type === 'message_delta') {
          if (e.delta?.stop_reason !== undefined) {
            finishReason = mapStopReason(e.delta.stop_reason);
          }
          if (e.usage?.output_tokens !== undefined) {
            outputTokens = e.usage.output_tokens;
          }
        }
      }
      yield { kind: 'done', inputTokens, outputTokens, finishReason };
    } catch (err) {
      const wrapped = wrapError(err, controller.signal.aborted, this.timeoutMs);
      yield { kind: 'error', error: wrapped.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
