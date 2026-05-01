import { describe, expect, it, vi } from 'vitest';
import { LlmProviderError, LlmRateLimitError } from './errors.js';
import { OpenAiProvider } from './openai.js';
import type { ChatRequest, ChatStreamEvent } from './types.js';

const baseRequest: ChatRequest = {
  messages: [
    { role: 'system', content: 'be helpful' },
    { role: 'user', content: 'hi' },
  ],
  tenantId: 'tenant-1',
};

const buildClient = (overrides: { create?: ReturnType<typeof vi.fn> }) => {
  return {
    chat: {
      completions: {
        create: overrides.create ?? vi.fn(),
      },
    },
  } as unknown as ConstructorParameters<typeof OpenAiProvider>[0]['client'];
};

describe('OpenAiProvider.chat', () => {
  it('maps chat.completions response to ChatResponse', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { role: 'assistant', content: 'hello world' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 8, completion_tokens: 3 },
    });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    const result = await provider.chat(baseRequest);
    expect(result).toEqual({
      text: 'hello world',
      inputTokens: 8,
      outputTokens: 3,
      finishReason: 'stop',
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0];
    expect(args.messages).toEqual([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('maps content_filter finish reason', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { role: 'assistant', content: '' },
          finish_reason: 'content_filter',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    const result = await provider.chat(baseRequest);
    expect(result.finishReason).toBe('content-filter');
  });

  it('wraps a 401 SDK error as non-retryable', async () => {
    const sdkErr = Object.assign(new Error('unauthorized'), {
      status: 401,
      request_id: 'req-x',
    });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new OpenAiProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(false);
    }
  });

  it('wraps 429 with retryAfter parsed from headers', async () => {
    const sdkErr = Object.assign(new Error('slow'), {
      status: 429,
      headers: { 'retry-after': '15' },
    });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new OpenAiProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmRateLimitError);
      expect((err as LlmRateLimitError).retryAfterSec).toBe(15);
    }
  });
});

describe('OpenAiProvider.chatStream', () => {
  it('forwards chunked deltas + accumulates usage from stream_options', async () => {
    async function* fakeStream() {
      yield {
        choices: [{ delta: { content: 'hel' }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: { content: 'lo' }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 2 },
      };
    }
    const create = vi.fn().mockResolvedValue(fakeStream());
    const provider = new OpenAiProvider({
      apiKey: 'k',
      client: buildClient({ create }),
    });
    const events: ChatStreamEvent[] = [];
    for await (const e of provider.chatStream(baseRequest)) events.push(e);
    expect(events).toEqual([
      { kind: 'token', text: 'hel' },
      { kind: 'token', text: 'lo' },
      {
        kind: 'done',
        inputTokens: 4,
        outputTokens: 2,
        finishReason: 'stop',
      },
    ]);
  });
});
