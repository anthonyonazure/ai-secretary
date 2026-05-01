import { describe, expect, it } from 'vitest';
import { MockLlmProvider } from './mock.js';
import type { ChatRequest, ChatStreamEvent } from './types.js';

const baseRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'hello' }],
  tenantId: 'tenant-1',
};

describe('MockLlmProvider', () => {
  it('returns the static response and records the request', async () => {
    const provider = new MockLlmProvider({
      response: {
        text: 'mocked output',
        inputTokens: 5,
        outputTokens: 3,
        finishReason: 'stop',
      },
    });
    const result = await provider.chat(baseRequest);
    expect(result.text).toBe('mocked output');
    expect(result.inputTokens).toBe(5);
    expect(result.outputTokens).toBe(3);
    expect(provider.lastRequest).toBe(baseRequest);
    expect(provider.callCount).toBe(1);
  });

  it('supports a function response source for per-request variation', async () => {
    const provider = new MockLlmProvider({
      response: (input) => ({
        text: `echo: ${input.messages[0]?.content ?? ''}`,
        inputTokens: 1,
        outputTokens: 2,
        finishReason: 'stop',
      }),
    });
    const result = await provider.chat(baseRequest);
    expect(result.text).toBe('echo: hello');
  });

  it('streams the static text in chunks then emits done', async () => {
    const provider = new MockLlmProvider({
      response: {
        text: 'abcdefghijabcdefghij',
        inputTokens: 4,
        outputTokens: 8,
        finishReason: 'stop',
      },
      streamChunkSize: 5,
    });
    const events: ChatStreamEvent[] = [];
    for await (const e of provider.chatStream(baseRequest)) events.push(e);
    expect(events.filter((e) => e.kind === 'token')).toHaveLength(4);
    const done = events.at(-1);
    expect(done?.kind).toBe('done');
    if (done?.kind === 'done') {
      expect(done.inputTokens).toBe(4);
      expect(done.outputTokens).toBe(8);
      expect(done.finishReason).toBe('stop');
    }
  });

  it('fromText helper produces a usable provider', async () => {
    const provider = MockLlmProvider.fromText('hi');
    const result = await provider.chat(baseRequest);
    expect(result.text).toBe('hi');
    expect(result.finishReason).toBe('stop');
  });
});
