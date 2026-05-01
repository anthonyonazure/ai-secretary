import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from './anthropic.js';
import { AzureOpenAiProvider } from './azure-openai.js';
import { AnthropicBedrockProvider } from './bedrock.js';
import { LlmProviderError } from './errors.js';
import { createLlmProvider } from './factory.js';
import { MockLlmProvider } from './mock.js';
import { OllamaProvider } from './ollama.js';
import { OpenAiProvider } from './openai.js';

describe('createLlmProvider', () => {
  it('builds AnthropicProvider when configs.anthropic is provided', () => {
    const provider = createLlmProvider({
      kind: 'anthropic',
      configs: { anthropic: { apiKey: 'sk-test' } },
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.kind).toBe('anthropic');
  });

  it('builds OpenAiProvider when configs.openai is provided', () => {
    const provider = createLlmProvider({
      kind: 'openai',
      configs: { openai: { apiKey: 'sk-test' } },
    });
    expect(provider).toBeInstanceOf(OpenAiProvider);
    expect(provider.kind).toBe('openai');
  });

  it('builds AzureOpenAiProvider with deployment URL', () => {
    const provider = createLlmProvider({
      kind: 'azure-openai',
      configs: {
        azureOpenai: {
          apiKey: 'k',
          endpoint: 'https://r.openai.azure.com',
          deployment: 'gpt-4o-deploy',
        },
      },
    });
    expect(provider).toBeInstanceOf(AzureOpenAiProvider);
    expect(provider.kind).toBe('azure-openai');
  });

  it('builds AnthropicBedrockProvider with region', () => {
    const provider = createLlmProvider({
      kind: 'bedrock',
      configs: { bedrock: { region: 'us-east-1' } },
    });
    expect(provider).toBeInstanceOf(AnthropicBedrockProvider);
    expect(provider.kind).toBe('bedrock');
  });

  it('builds OllamaProvider with endpoint', () => {
    const provider = createLlmProvider({
      kind: 'ollama',
      configs: { ollama: { endpoint: 'http://localhost:11434' } },
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.kind).toBe('ollama');
  });

  it('returns the injected MockLlmProvider when configs.mock is one', () => {
    const mock = MockLlmProvider.fromText('x');
    const provider = createLlmProvider({
      kind: 'mock',
      configs: { mock },
    });
    expect(provider).toBe(mock);
  });

  it('builds a MockLlmProvider from staticResponse shape', () => {
    const provider = createLlmProvider({
      kind: 'mock',
      configs: {
        mock: {
          staticResponse: {
            text: 'hi',
            inputTokens: 0,
            outputTokens: 0,
            finishReason: 'stop',
          },
        },
      },
    });
    expect(provider).toBeInstanceOf(MockLlmProvider);
  });

  it('throws LlmProviderError when anthropic config is missing', () => {
    expect(() =>
      createLlmProvider({
        kind: 'anthropic',
        configs: {},
      }),
    ).toThrow(LlmProviderError);
  });

  it('throws LlmProviderError when bedrock config is missing', () => {
    expect(() =>
      createLlmProvider({
        kind: 'bedrock',
        configs: {},
      }),
    ).toThrow(LlmProviderError);
  });

  it('throws LlmProviderError when azure-openai config is missing', () => {
    expect(() =>
      createLlmProvider({
        kind: 'azure-openai',
        configs: {},
      }),
    ).toThrow(LlmProviderError);
  });

  it('throws LlmProviderError when ollama endpoint is missing', () => {
    expect(() =>
      createLlmProvider({
        kind: 'ollama',
        configs: {},
      }),
    ).toThrow(LlmProviderError);
  });

  it('marks missing-config errors as non-retryable', () => {
    try {
      createLlmProvider({ kind: 'anthropic', configs: {} });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      expect((err as LlmProviderError).retryable).toBe(false);
    }
  });
});
