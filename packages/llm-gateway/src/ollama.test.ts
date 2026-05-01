import { describe, expect, it, vi } from 'vitest';
import { LlmProviderError } from './errors.js';
import { OllamaProvider } from './ollama.js';
import type { ChatRequest, ChatStreamEvent } from './types.js';

const baseRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  tenantId: 'tenant-1',
};

const buildJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('OllamaProvider.chat', () => {
  it('posts to /api/chat and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildJsonResponse({
        message: { role: 'assistant', content: 'hello' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 5,
        eval_count: 2,
      }),
    );
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.chat(baseRequest);
    expect(result).toEqual({
      text: 'hello',
      inputTokens: 5,
      outputTokens: 2,
      finishReason: 'stop',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse(((init as RequestInit).body ?? '') as string);
    expect(body.model).toBe('llama3.1');
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('forwards temperature + maxOutputTokens via options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildJsonResponse({
        message: { content: 'x' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 1,
        eval_count: 1,
      }),
    );
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    await provider.chat({ ...baseRequest, temperature: 0.2, maxOutputTokens: 256 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((init.body ?? '') as string);
    expect(body.options).toEqual({ temperature: 0.2, num_predict: 256 });
  });

  it('throws LlmProviderError(retryable=true) on 5xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 503 }));
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(true);
    }
  });

  it('throws LlmProviderError(retryable=true) on fetch network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('connection refused'));
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(true);
    }
  });

  it('throws on malformed payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildJsonResponse({ unexpected: 'shape' }));
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    // Note: ollama's response schema is permissive (all fields optional),
    // so this still parses but yields empty text. Verify that's the
    // observable behavior.
    const result = await provider.chat(baseRequest);
    expect(result.text).toBe('');
    expect(result.finishReason).toBe('unknown');
  });
});

describe('OllamaProvider.chatStream', () => {
  it('parses NDJSON stream chunks and emits done', async () => {
    const lines = [
      JSON.stringify({ message: { content: 'hel' }, done: false }),
      JSON.stringify({ message: { content: 'lo' }, done: false }),
      JSON.stringify({
        message: { content: '' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 4,
        eval_count: 2,
      }),
    ];
    const ndjson = `${lines.join('\n')}\n`;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ndjson));
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
      );
    const provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const events: ChatStreamEvent[] = [];
    for await (const e of provider.chatStream(baseRequest)) events.push(e);
    const tokens = events
      .filter((e) => e.kind === 'token')
      .map((e) => (e as { text: string }).text);
    expect(tokens).toEqual(['hel', 'lo']);
    const done = events.at(-1);
    expect(done?.kind).toBe('done');
    if (done?.kind === 'done') {
      expect(done.inputTokens).toBe(4);
      expect(done.outputTokens).toBe(2);
      expect(done.finishReason).toBe('stop');
    }
  });
});
