import { describe, expect, it, vi } from 'vitest';
import { AzureOpenAiProvider } from './azure-openai.js';
import type { ChatRequest } from './types.js';

const baseRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  tenantId: 'tenant-1',
};

const buildClient = (overrides: { create?: ReturnType<typeof vi.fn> }) => {
  return {
    chat: {
      completions: {
        create: overrides.create ?? vi.fn(),
      },
    },
  } as unknown as ConstructorParameters<typeof AzureOpenAiProvider>[0]['client'];
};

describe('AzureOpenAiProvider', () => {
  it('exposes kind === "azure-openai"', () => {
    const provider = new AzureOpenAiProvider({
      apiKey: 'k',
      endpoint: 'https://r.openai.azure.com',
      deployment: 'd',
      client: buildClient({ create: vi.fn() }),
    });
    expect(provider.kind).toBe('azure-openai');
  });

  it('reuses OpenAiProvider chat impl with the deployment as model', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { role: 'assistant', content: 'azure said hi' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 2, completion_tokens: 3 },
    });
    const provider = new AzureOpenAiProvider({
      apiKey: 'k',
      endpoint: 'https://r.openai.azure.com',
      deployment: 'gpt-4o-deploy',
      client: buildClient({ create }),
    });
    const result = await provider.chat(baseRequest);
    expect(result.text).toBe('azure said hi');
    const args = create.mock.calls[0]?.[0];
    // Azure routes by deployment name in the URL, but the SDK still
    // sends a `model` field; we set it to the deployment name.
    expect(args.model).toBe('gpt-4o-deploy');
  });

  it('surfaces errors with providerKind === "azure-openai"', async () => {
    const sdkErr = Object.assign(new Error('bad'), { status: 500 });
    const create = vi.fn().mockRejectedValue(sdkErr);
    const provider = new AzureOpenAiProvider({
      apiKey: 'k',
      endpoint: 'https://r.openai.azure.com',
      deployment: 'd',
      client: buildClient({ create }),
    });
    try {
      await provider.chat(baseRequest);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as { providerKind?: string }).providerKind).toBe('azure-openai');
    }
  });
});
