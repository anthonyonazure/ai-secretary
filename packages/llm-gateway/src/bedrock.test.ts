import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnthropicBedrockProvider } from './bedrock.js';
import { LlmProviderError, LlmRateLimitError } from './errors.js';
import type { ChatRequest, ChatStreamEvent } from './types.js';

const bedrockMock = mockClient(BedrockRuntimeClient);

const baseRequest: ChatRequest = {
  messages: [
    { role: 'system', content: 'be helpful' },
    { role: 'user', content: 'hi' },
  ],
  tenantId: 'tenant-1',
};

const buildProvider = () =>
  new AnthropicBedrockProvider({
    region: 'us-east-1',
    client: new BedrockRuntimeClient({ region: 'us-east-1' }),
  });

const encodeJson = (obj: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(obj));

describe('AnthropicBedrockProvider.chat', () => {
  beforeEach(() => {
    bedrockMock.reset();
  });
  afterEach(() => {
    bedrockMock.reset();
  });

  it('maps InvokeModel response to ChatResponse', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({
      body: encodeJson({
        content: [{ type: 'text', text: 'hello world' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 4 },
      }),
    });
    const provider = buildProvider();
    const result = await provider.chat(baseRequest);
    expect(result).toEqual({
      text: 'hello world',
      inputTokens: 10,
      outputTokens: 4,
      finishReason: 'stop',
    });
    const calls = bedrockMock.commandCalls(InvokeModelCommand);
    expect(calls).toHaveLength(1);
    const sent = calls[0]?.args[0]?.input;
    const body = JSON.parse(new TextDecoder().decode(sent?.body as Uint8Array));
    expect(body.system).toBe('be helpful');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.anthropic_version).toBe('bedrock-2023-05-31');
  });

  it('uses the configured modelId', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({
      body: encodeJson({
        content: [{ type: 'text', text: '' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    });
    const provider = new AnthropicBedrockProvider({
      region: 'eu-west-1',
      modelId: 'anthropic.claude-opus-4-1-v1:0',
      client: new BedrockRuntimeClient({ region: 'eu-west-1' }),
    });
    await provider.chat(baseRequest);
    const sent = bedrockMock.commandCalls(InvokeModelCommand)[0]?.args[0]?.input;
    expect(sent?.modelId).toBe('anthropic.claude-opus-4-1-v1:0');
  });

  it('wraps a 4xx error as non-retryable', async () => {
    const err = Object.assign(new Error('bad request'), {
      $metadata: { httpStatusCode: 400, requestId: 'req-1' },
      name: 'ValidationException',
    });
    bedrockMock.on(InvokeModelCommand).rejects(err);
    const provider = buildProvider();
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LlmProviderError);
      expect((e as LlmProviderError).retryable).toBe(false);
      expect((e as LlmProviderError).providerKind).toBe('bedrock');
    }
  });

  it('wraps ThrottlingException as LlmRateLimitError', async () => {
    const err = Object.assign(new Error('throttle'), {
      $metadata: { httpStatusCode: 429 },
      name: 'ThrottlingException',
    });
    bedrockMock.on(InvokeModelCommand).rejects(err);
    const provider = buildProvider();
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LlmRateLimitError);
    }
  });

  it('wraps a 5xx error as retryable', async () => {
    const err = Object.assign(new Error('upstream'), {
      $metadata: { httpStatusCode: 503 },
      name: 'ServiceUnavailableException',
    });
    bedrockMock.on(InvokeModelCommand).rejects(err);
    const provider = buildProvider();
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LlmProviderError);
      expect((e as LlmProviderError).retryable).toBe(true);
    }
  });
});

describe('AnthropicBedrockProvider.chatStream', () => {
  beforeEach(() => {
    bedrockMock.reset();
  });

  it('decodes stream chunks and emits token + done', async () => {
    async function* fakeBody() {
      yield {
        chunk: {
          bytes: encodeJson({
            type: 'message_start',
            message: { usage: { input_tokens: 12, output_tokens: 0 } },
          }),
        },
      };
      yield {
        chunk: {
          bytes: encodeJson({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'hel' },
          }),
        },
      };
      yield {
        chunk: {
          bytes: encodeJson({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'lo' },
          }),
        },
      };
      yield {
        chunk: {
          bytes: encodeJson({
            type: 'message_delta',
            delta: { stop_reason: 'end_turn' },
            usage: { output_tokens: 2 },
          }),
        },
      };
    }
    bedrockMock.on(InvokeModelWithResponseStreamCommand).resolves({
      // The mock accepts any body shape; the provider iterates with for-await
      // so we hand it an async generator directly.
      body: fakeBody() as unknown as never,
    });
    const provider = buildProvider();
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
});
