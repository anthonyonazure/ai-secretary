import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LlmProviderError, LlmSchemaParseError } from './errors.js';
import { type LlmAuditLogger, LlmGateway } from './gateway.js';
import { MockLlmProvider } from './mock.js';
import type { TenantLlmContext } from './selector.js';
import type { ChatRequest, ChatResponse, LlmProvider } from './types.js';

const baseTenant: TenantLlmContext = {
  region: 'us',
  compliancePosture: {},
};

const baseRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  tenantId: 'tenant-1',
};

const buildResponse = (overrides: Partial<ChatResponse> = {}): ChatResponse => ({
  text: 'ok',
  inputTokens: 5,
  outputTokens: 3,
  finishReason: 'stop',
  ...overrides,
});

describe('LlmGateway.chat', () => {
  it('routes to the primary provider returned by the selector', async () => {
    const primary = MockLlmProvider.fromText('primary said hi');
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: { mock: primary, anthropic: { apiKey: 'k' } },
      // Override the factory to always hand back our mock so we can
      // assert without booting the real Anthropic client.
      createProvider: () => primary,
    });
    const result = await gateway.chat(baseRequest);
    expect(result.text).toBe('primary said hi');
    expect(primary.callCount).toBe(1);
  });

  it('emits an audit-log entry on success', async () => {
    const provider = new MockLlmProvider({
      response: buildResponse({ text: 'done', inputTokens: 7, outputTokens: 4 }),
    });
    const log = vi.fn();
    const auditLogger: LlmAuditLogger = { log };
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      auditLogger,
      createProvider: () => provider,
    });
    await gateway.chat(baseRequest);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      tenantId: 'tenant-1',
      providerKind: 'mock',
      inputTokens: 7,
      outputTokens: 4,
      finishReason: 'stop',
      fellBack: false,
    });
  });

  it('falls back to the next provider on retryable error when enableFallback', async () => {
    const failing: LlmProvider = {
      kind: 'anthropic',
      chat: vi.fn().mockRejectedValue(new LlmProviderError('anthropic', 'upstream', true)),
      chatStream: async function* () {
        yield { kind: 'error', error: 'never' };
      },
    };
    const succeeding = MockLlmProvider.fromText('fallback worked');
    let callCount = 0;
    const factory = vi.fn(() => {
      callCount += 1;
      return callCount === 1 ? failing : succeeding;
    });
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      enableFallback: true,
      createProvider: factory,
    });
    const result = await gateway.chat(baseRequest);
    expect(result.text).toBe('fallback worked');
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('does NOT fall back on non-retryable error', async () => {
    const failing: LlmProvider = {
      kind: 'anthropic',
      chat: vi.fn().mockRejectedValue(new LlmProviderError('anthropic', 'auth', false)),
      chatStream: async function* () {
        yield { kind: 'error', error: 'never' };
      },
    };
    const factory = vi.fn(() => failing);
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      enableFallback: true,
      createProvider: factory,
    });
    await expect(gateway.chat(baseRequest)).rejects.toBeInstanceOf(LlmProviderError);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('audits a terminal failure with finishReason="error"', async () => {
    const failing: LlmProvider = {
      kind: 'anthropic',
      chat: vi.fn().mockRejectedValue(new LlmProviderError('anthropic', 'auth', false)),
      chatStream: async function* () {
        yield { kind: 'error', error: 'never' };
      },
    };
    const log = vi.fn();
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      auditLogger: { log },
      createProvider: () => failing,
    });
    await expect(gateway.chat(baseRequest)).rejects.toBeInstanceOf(LlmProviderError);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      providerKind: 'anthropic',
      finishReason: 'error',
    });
  });

  it('schema-parses the response and returns parsed payload', async () => {
    const schema = z.object({ summary: z.string(), score: z.number() });
    const provider = new MockLlmProvider({
      response: buildResponse({ text: '{"summary":"all good","score":0.9}' }),
    });
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      createProvider: () => provider,
    });
    const result = await gateway.chat({ ...baseRequest, responseSchema: schema });
    expect(result.parsed).toEqual({ summary: 'all good', score: 0.9 });
  });

  it('strips ```json fences when parsing', async () => {
    const schema = z.object({ ok: z.boolean() });
    const provider = new MockLlmProvider({
      response: buildResponse({ text: '```json\n{"ok":true}\n```' }),
    });
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      createProvider: () => provider,
    });
    const result = await gateway.chat({ ...baseRequest, responseSchema: schema });
    expect(result.parsed).toEqual({ ok: true });
  });

  it('retries once on schema-parse failure', async () => {
    const schema = z.object({ score: z.number() });
    const responses: ChatResponse[] = [
      buildResponse({ text: 'totally not json' }),
      buildResponse({ text: '{"score":0.5}' }),
    ];
    let i = 0;
    const provider: LlmProvider = {
      kind: 'mock',
      chat: vi.fn(async () => {
        const r = responses[i++];
        if (!r) throw new Error('no more responses');
        return r;
      }),
      chatStream: async function* () {
        yield { kind: 'error', error: 'never' };
      },
    };
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      createProvider: () => provider,
    });
    const result = await gateway.chat({ ...baseRequest, responseSchema: schema });
    expect(result.parsed).toEqual({ score: 0.5 });
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

  it('throws LlmSchemaParseError after second parse failure', async () => {
    const schema = z.object({ x: z.number() });
    const provider = new MockLlmProvider({
      response: buildResponse({ text: 'still not json' }),
    });
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      createProvider: () => provider,
    });
    await expect(gateway.chat({ ...baseRequest, responseSchema: schema })).rejects.toBeInstanceOf(
      LlmSchemaParseError,
    );
  });
});

describe('LlmGateway.chatStream', () => {
  it('streams from the primary provider', async () => {
    const provider = MockLlmProvider.fromText('hello world');
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      createProvider: () => provider,
    });
    const events: string[] = [];
    for await (const e of gateway.chatStream(baseRequest)) {
      if (e.kind === 'token') events.push(e.text);
    }
    expect(events.join('')).toBe('hello world');
  });

  it('falls back when the primary stream emits an error first', async () => {
    const failing: LlmProvider = {
      kind: 'anthropic',
      chat: vi.fn(),
      chatStream: async function* () {
        yield { kind: 'error', error: 'boom' };
      },
    };
    const succeeding = MockLlmProvider.fromText('ok');
    let i = 0;
    const factory = () => {
      i += 1;
      return i === 1 ? failing : succeeding;
    };
    const gateway = new LlmGateway({
      tenant: baseTenant,
      configs: {},
      enableFallback: true,
      createProvider: factory,
    });
    const tokens: string[] = [];
    for await (const e of gateway.chatStream(baseRequest)) {
      if (e.kind === 'token') tokens.push(e.text);
    }
    expect(tokens.join('')).toBe('ok');
  });
});
