import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  FinishReason,
  LlmProvider,
} from './types.js';

/**
 * Deterministic LLM provider for tests + dev environments.
 *
 * Test integrations inject this so they don't talk to a real provider.
 * Dev environments fall back to it when no provider creds are set —
 * the gateway logs a warning and uses the mock so the rest of the
 * pipeline (audit logging, schema-parse retry, fallback chains) can
 * still be exercised end-to-end.
 *
 * Two construction modes:
 *   1. Static — pass a fixed `ChatResponse`.
 *   2. Function — pass `(input) => response | Promise<response>`; lets
 *      tests assert routing / vary output by request shape.
 *
 * Streaming: `chatStream` chunks the static text into ~16-char tokens
 * (deterministic; tests can rely on the chunking shape) and emits a
 * terminal `done` event with the recorded usage counts.
 */

export type MockResponseFn = (input: ChatRequest) => ChatResponse | Promise<ChatResponse>;

export interface MockLlmProviderOptions {
  /** Static response, OR a function that produces one per call. */
  response: ChatResponse | MockResponseFn;
  /** Override the streaming chunk size (chars). Default: 16. */
  streamChunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 16;

export class MockLlmProvider implements LlmProvider {
  readonly kind = 'mock' as const;
  /** Last request seen — useful in tests to assert routing. */
  lastRequest: ChatRequest | null = null;
  /** Count of `chat()` invocations — useful for fallback assertions. */
  callCount = 0;
  private readonly responseSource: ChatResponse | MockResponseFn;
  private readonly streamChunkSize: number;

  constructor(options: MockLlmProviderOptions) {
    this.responseSource = options.response;
    this.streamChunkSize = options.streamChunkSize ?? DEFAULT_CHUNK_SIZE;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    this.lastRequest = input;
    this.callCount += 1;
    if (typeof this.responseSource === 'function') {
      return await this.responseSource(input);
    }
    return this.responseSource;
  }

  async *chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const response = await this.chat(input);
    const chunkSize = this.streamChunkSize;
    for (let i = 0; i < response.text.length; i += chunkSize) {
      yield { kind: 'token', text: response.text.slice(i, i + chunkSize) };
    }
    yield {
      kind: 'done',
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      finishReason: response.finishReason,
    };
  }

  /**
   * Build a mock that returns the given text with default token counts
   * + finish reason. Common helper for tests that don't care about
   * usage accounting.
   */
  static fromText(text: string, finishReason: FinishReason = 'stop'): MockLlmProvider {
    return new MockLlmProvider({
      response: {
        text,
        inputTokens: 0,
        outputTokens: 0,
        finishReason,
      },
    });
  }
}
