import { z } from 'zod';
import { LlmProviderError, LlmTimeoutError } from './errors.js';
import {
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  DEFAULT_LLM_TIMEOUT_MS,
  type FinishReason,
  type LlmProvider,
} from './types.js';

/**
 * Self-hosted Ollama provider.
 *
 * Used for on-prem deployments + local dev. The endpoint is configured
 * per-environment (`OLLAMA_URL`); this provider never hardcodes a URL
 * (CLAUDE.md § Anti-Patterns: "Hardcoded provider URLs / endpoints").
 *
 * Wire format (Ollama 0.4+ — chat endpoint):
 *   POST {endpoint}/api/chat
 *   Content-Type: application/json
 *   { "model": "llama3.1", "messages": [...], "stream": false,
 *     "options": { "temperature": 0.7, "num_predict": 4096 } }
 *
 *   200 OK (non-stream):
 *   { "message": { "role": "assistant", "content": "..." },
 *     "done": true, "done_reason": "stop",
 *     "prompt_eval_count": 42, "eval_count": 128 }
 *
 *   200 OK (stream): NDJSON, one chunk per line, terminal chunk has
 *   `done: true` and the final usage counts.
 *
 * No SDK — plain `fetch`. The provider-isolation grep doesn't ban
 * anything from this file because there's nothing to ban.
 */

const PROVIDER_KIND = 'ollama' as const;
const DEFAULT_MODEL = 'llama3.1';

export interface OllamaProviderConfig {
  /** Base URL of the Ollama service, e.g. `http://localhost:11434`. */
  endpoint: string;
  /** Override the model — defaults to `llama3.1`. */
  model?: string;
  /** Override the per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  /** Override `fetch` (tests). Default uses global `fetch`. */
  fetch?: typeof fetch;
}

const ollamaResponseSchema = z.object({
  message: z
    .object({
      content: z.string().optional(),
    })
    .optional(),
  done: z.boolean().optional(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

const ollamaStreamChunkSchema = z.object({
  message: z
    .object({
      content: z.string().optional(),
    })
    .optional(),
  done: z.boolean().optional(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

const mapDoneReason = (raw: string | undefined): FinishReason => {
  switch (raw) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    default:
      return raw === undefined ? 'unknown' : 'stop';
  }
};

export class OllamaProvider implements LlmProvider {
  readonly kind = PROVIDER_KIND;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OllamaProviderConfig) {
    if (!config.endpoint) {
      throw new LlmProviderError(
        PROVIDER_KIND,
        'endpoint is required (configure OLLAMA_URL)',
        false,
      );
    }
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.model = config.model ?? DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
    this.fetchImpl = config.fetch ?? fetch;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: input.messages,
        stream: false,
      };
      const options: Record<string, unknown> = {};
      if (input.temperature !== undefined) options.temperature = input.temperature;
      if (input.maxOutputTokens !== undefined) options.num_predict = input.maxOutputTokens;
      if (Object.keys(options).length > 0) body.options = options;

      const response = await this.fetchImpl(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '<unreadable>');
        throw new LlmProviderError(
          PROVIDER_KIND,
          `endpoint returned ${response.status}: ${text.slice(0, 200)}`,
          response.status >= 500,
        );
      }
      const json = (await response.json()) as unknown;
      const parsed = ollamaResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new LlmProviderError(
          PROVIDER_KIND,
          `endpoint returned malformed payload: ${parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
          false,
        );
      }
      return {
        text: parsed.data.message?.content ?? '',
        inputTokens: parsed.data.prompt_eval_count ?? 0,
        outputTokens: parsed.data.eval_count ?? 0,
        finishReason: mapDoneReason(parsed.data.done_reason),
      };
    } catch (err) {
      if (controller.signal.aborted) {
        throw new LlmTimeoutError(this.timeoutMs, err);
      }
      if (err instanceof LlmProviderError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      // Network / fetch failures are retryable.
      throw new LlmProviderError(PROVIDER_KIND, message, true, undefined, err);
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
      const body: Record<string, unknown> = {
        model: this.model,
        messages: input.messages,
        stream: true,
      };
      const options: Record<string, unknown> = {};
      if (input.temperature !== undefined) options.temperature = input.temperature;
      if (input.maxOutputTokens !== undefined) options.num_predict = input.maxOutputTokens;
      if (Object.keys(options).length > 0) body.options = options;

      const response = await this.fetchImpl(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '<unreadable>');
        yield {
          kind: 'error',
          error: `[ollama] endpoint returned ${response.status}: ${text.slice(0, 200)}`,
        };
        return;
      }
      if (!response.body) {
        yield { kind: 'error', error: '[ollama] response body missing' };
        return;
      }

      // NDJSON stream — one JSON object per newline-delimited chunk.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx = buffer.indexOf('\n');
        while (newlineIdx >= 0) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (line.length > 0) {
            const json: unknown = (() => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })();
            if (json !== null) {
              const parsed = ollamaStreamChunkSchema.safeParse(json);
              if (parsed.success) {
                const tokenText = parsed.data.message?.content ?? '';
                if (tokenText.length > 0) {
                  yield { kind: 'token', text: tokenText };
                }
                if (parsed.data.done === true) {
                  inputTokens = parsed.data.prompt_eval_count ?? inputTokens;
                  outputTokens = parsed.data.eval_count ?? outputTokens;
                  finishReason = mapDoneReason(parsed.data.done_reason);
                }
              }
            }
          }
          newlineIdx = buffer.indexOf('\n');
        }
      }
      yield { kind: 'done', inputTokens, outputTokens, finishReason };
    } catch (err) {
      if (controller.signal.aborted) {
        const wrapped = new LlmTimeoutError(this.timeoutMs, err);
        yield { kind: 'error', error: wrapped.message };
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      yield { kind: 'error', error: `[${PROVIDER_KIND}] ${message}` };
    } finally {
      clearTimeout(timeout);
    }
  }
}
