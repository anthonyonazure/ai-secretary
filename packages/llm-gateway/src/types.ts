/**
 * Public contract for the LLM-gateway provider abstraction.
 *
 * Story 3.0 ships:
 *   - `AnthropicProvider`     — direct Anthropic API (default for non-regulated US tenants)
 *   - `OpenAiProvider`        — OpenAI ZDR (fallback)
 *   - `AzureOpenAiProvider`   — Azure OpenAI HIPAA-eligible deployment
 *   - `AnthropicBedrockProvider` — Anthropic via AWS Bedrock (HIPAA + EU)
 *   - `OllamaProvider`        — self-hosted Ollama (on-prem + local dev)
 *   - `MockLlmProvider`       — deterministic; tests + dev
 *
 * Per-tenant routing lives in `selector.ts`; the gateway
 * (`gateway.ts`) calls the selector first, then asks the factory for a
 * concrete provider, then handles fallback + schema-parse retry + audit.
 *
 * EMBEDDINGS are out of scope here — the embeddings interface lives in a
 * separate `packages/embeddings` package (future story). This gateway
 * only abstracts CHAT (single-shot + streaming).
 */

import type { z } from 'zod';

/**
 * Discriminator used by the factory + gateway logging + audit-log rows.
 *
 * - `anthropic`     direct Anthropic API
 * - `openai`        direct OpenAI API (ZDR)
 * - `azure-openai`  OpenAI SDK pointed at an Azure OpenAI deployment
 * - `bedrock`       Anthropic-on-Bedrock via @aws-sdk/client-bedrock-runtime
 * - `ollama`        self-hosted Ollama HTTP endpoint
 * - `mock`          deterministic; tests + dev
 */
export type LlmProviderKind =
  | 'anthropic'
  | 'openai'
  | 'azure-openai'
  | 'bedrock'
  | 'ollama'
  | 'mock';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Provider-reported finish reason — surfaced verbatim on `ChatResponse`
 * and used by callers to distinguish "model decided it was done"
 * (`stop`) from "we hit the token cap" (`length`) or "the safety
 * classifier blocked it" (`content-filter`).
 */
export type FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-use' | 'unknown';

export interface ChatRequest {
  messages: ChatMessage[];
  /**
   * Output schema — when set, the gateway asks the provider for
   * structured JSON matching this shape and zod-parses the response.
   * On parse failure the gateway retries once with an injected system
   * message asking the model to fix the JSON shape (see `gateway.ts`).
   */
  responseSchema?: z.ZodSchema;
  maxOutputTokens?: number;
  temperature?: number;
  /**
   * Logging context — drives audit row + log line. NOT routing — the
   * selector has already resolved the provider kind by the time
   * `provider.chat(...)` is called.
   */
  tenantId: string;
  /**
   * Optional caller-provided abort signal — stays alive until the
   * response resolves or rejects. Each provider also enforces its own
   * `timeoutMs` ceiling (default 60s, configurable via `LLM_TIMEOUT_MS`).
   */
  signal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  /**
   * When `responseSchema` was supplied, this is the zod-parsed object;
   * otherwise the field is omitted. Callers narrow via the parsed schema.
   */
  parsed?: unknown;
  inputTokens: number;
  outputTokens: number;
  finishReason: FinishReason;
}

/**
 * Streaming chunk shape.
 *
 *   { kind: 'token', text: '...' }       per emitted text chunk
 *   { kind: 'done',  inputTokens, outputTokens, finishReason }  terminal success
 *   { kind: 'error', error: 'message' }  terminal failure
 *
 * Consumers iterate the async iterable until they observe a terminal
 * event (`done` or `error`). The provider closes the iterator after a
 * terminal event — no further tokens follow.
 */
export type ChatStreamEvent =
  | { kind: 'token'; text: string }
  | {
      kind: 'done';
      inputTokens: number;
      outputTokens: number;
      finishReason: FinishReason;
    }
  | { kind: 'error'; error: string };

export interface LlmProvider {
  /** Discriminator — useful for logging + tests. */
  kind: LlmProviderKind;
  /** Single-shot completion. Throws `LlmProviderError` on provider error. */
  chat(input: ChatRequest): Promise<ChatResponse>;
  /** Streaming completion — async iterator of chunks. Never throws; emits `kind: 'error'`. */
  chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent>;
}

/**
 * Default per-call timeout. All real providers honor this via
 * AbortSignal; the mock ignores it. Override via `LLM_TIMEOUT_MS` env
 * at gateway construction.
 */
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;

/**
 * Default response token cap. Generous enough for a meeting summary
 * (~2K tokens) but cheap to override per-call via `ChatRequest.maxOutputTokens`.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;
