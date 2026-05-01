import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from './anthropic.js';
import { LlmProviderError, LlmRateLimitError } from './errors.js';
import type { ChatRequest, ChatStreamEvent } from './types.js';

/**
 * The Anthropic SDK is mocked at the client level — we instantiate the
 * provider with a `client` override so the real SDK never makes a
 * network call. The mock's `messages.create` and `messages.stream`
 * return shapes that match the SDK's documented response objects.
 */

const baseRequest: ChatRequest = {
  messages: [
    { role: 'system', content: 'be helpful' },
    { role: 'user', content: 'hi' },
  ],
  tenantId: 'tenant-1',
};

const buildClient = (overrides: {
  create?: ReturnType<typeof vi.fn>;
  stream?: ReturnType<typeof vi.fn>;
}) => {
  return {
    messages: {
      create: overrides.create ?? vi.fn(),
      stream: overrides.stream ?? vi.fn(),
    },
  } as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'];
};

describe('AnthropicProvider.chat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps Messages.create response to ChatResponse', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'hello world' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 4 },
    });
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    const result = await provider.chat(baseRequest);
    expect(result).toEqual({
      text: 'hello world',
      inputTokens: 10,
      outputTokens: 4,
      finishReason: 'stop',
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0];
    expect(args.system).toBe('be helpful');
    expect(args.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('maps stop_reason "max_tokens" to "length"', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'truncated' }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    const result = await provider.chat(baseRequest);
    expect(result.finishReason).toBe('length');
  });

  it('wraps a 4xx SDK error as non-retryable LlmProviderError', async () => {
    const sdkErr = Object.assign(new Error('bad request'), {
      status: 400,
      headers: { 'request-id': 'req-1' },
    });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(false);
      expect((err as LlmProviderError).providerKind).toBe('anthropic');
    }
  });

  it('wraps a 5xx SDK error as retryable LlmProviderError', async () => {
    const sdkErr = Object.assign(new Error('upstream'), { status: 503 });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(true);
    }
  });

  it('wraps 429 as LlmRateLimitError with retryAfter', async () => {
    const sdkErr = Object.assign(new Error('rate'), {
      status: 429,
      headers: { 'retry-after': '7' },
    });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmRateLimitError);
      expect((err as LlmRateLimitError).retryAfterSec).toBe(7);
    }
  });
});

describe('AnthropicProvider.chatStream', () => {
  it('maps SDK stream events to token + done', async () => {
    async function* fakeStream() {
      yield {
        type: 'message_start',
        message: { usage: { input_tokens: 12, output_tokens: 0 } },
      };
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'hel' },
      };
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'lo' },
      };
      yield {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 2 },
      };
    }
    const stream = vi.fn().mockReturnValue(fakeStream());
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ stream }),
    });
    const events: ChatStreamEvent[] = [];
    for await (const e of provider.chatStream(baseRequest)) events.push(e);
    expect(events).toEqual([
      { kind: 'token', text: 'hel' },
      { kind: 'token', text: 'lo' },
      {
        kind: 'done',
        inputTokens: 12,
        outputTokens: 2,
        finishReason: 'stop',
      },
    ]);
  });

  it('emits error event when SDK stream throws', async () => {
    async function* fakeStream() {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      throw Object.assign(new Error('boom'), { status: 500 });
    }
    const stream = vi.fn().mockReturnValue(fakeStream());
    const provider = new AnthropicProvider({
      apiKey: 'k',
      client: buildClient({ stream }),
    });
    const events: ChatStreamEvent[] = [];
    for await (const e of provider.chatStream(baseRequest)) events.push(e);
    const last = events.at(-1);
    expect(last?.kind).toBe('error');
  });
});
