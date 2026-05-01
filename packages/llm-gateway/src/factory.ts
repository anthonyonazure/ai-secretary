import { AnthropicProvider } from './anthropic.js';
import { AzureOpenAiProvider } from './azure-openai.js';
import { AnthropicBedrockProvider } from './bedrock.js';
import { LlmProviderError } from './errors.js';
import { MockLlmProvider } from './mock.js';
import { OllamaProvider } from './ollama.js';
import { OpenAiProvider } from './openai.js';
import type { ChatResponse, LlmProvider, LlmProviderKind } from './types.js';

/**
 * Factory: pick the concrete `LlmProvider` for the kind the selector
 * returned. The gateway calls this for the primary kind first, then
 * each fallback kind on retryable errors.
 *
 * Failure modes — every kind throws `LlmProviderError({ retryable: false })`
 * when its required config is missing. The gateway treats this as a
 * non-retryable provider error and either falls back to the next kind
 * (if `enableFallback`) or surfaces the error to the caller.
 */

export interface LlmProviderConfigs {
  anthropic?: { apiKey: string; model?: string; timeoutMs?: number };
  openai?: { apiKey: string; model?: string; timeoutMs?: number };
  azureOpenai?: {
    apiKey: string;
    endpoint: string;
    deployment: string;
    apiVersion?: string;
    timeoutMs?: number;
  };
  bedrock?: { region: string; modelId?: string; timeoutMs?: number };
  ollama?: { endpoint: string; model?: string; timeoutMs?: number };
  /**
   * Mock injection point — when present, `kind: 'mock'` resolves to
   * this provider. Dev/test code passes a `MockLlmProvider`; production
   * leaves this undefined.
   */
  mock?: MockLlmProvider | { staticResponse: ChatResponse };
}

export interface CreateLlmProviderOpts {
  kind: LlmProviderKind;
  configs: LlmProviderConfigs;
}

const requireConfig = <T>(kind: LlmProviderKind, value: T | undefined, hint: string): T => {
  if (value === undefined) {
    throw new LlmProviderError(
      kind,
      `createLlmProvider({ kind: '${kind}' }) requires ${hint}`,
      false,
    );
  }
  return value;
};

export function createLlmProvider({ kind, configs }: CreateLlmProviderOpts): LlmProvider {
  switch (kind) {
    case 'anthropic': {
      const cfg = requireConfig(kind, configs.anthropic, 'configs.anthropic.apiKey');
      return new AnthropicProvider({
        apiKey: cfg.apiKey,
        ...(cfg.model !== undefined ? { model: cfg.model } : {}),
        ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
      });
    }
    case 'openai': {
      const cfg = requireConfig(kind, configs.openai, 'configs.openai.apiKey');
      return new OpenAiProvider({
        apiKey: cfg.apiKey,
        ...(cfg.model !== undefined ? { model: cfg.model } : {}),
        ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
      });
    }
    case 'azure-openai': {
      const cfg = requireConfig(
        kind,
        configs.azureOpenai,
        'configs.azureOpenai.{apiKey,endpoint,deployment}',
      );
      return new AzureOpenAiProvider({
        apiKey: cfg.apiKey,
        endpoint: cfg.endpoint,
        deployment: cfg.deployment,
        ...(cfg.apiVersion !== undefined ? { apiVersion: cfg.apiVersion } : {}),
        ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
      });
    }
    case 'bedrock': {
      const cfg = requireConfig(kind, configs.bedrock, 'configs.bedrock.region');
      return new AnthropicBedrockProvider({
        region: cfg.region,
        ...(cfg.modelId !== undefined ? { modelId: cfg.modelId } : {}),
        ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
      });
    }
    case 'ollama': {
      const cfg = requireConfig(kind, configs.ollama, 'configs.ollama.endpoint');
      return new OllamaProvider({
        endpoint: cfg.endpoint,
        ...(cfg.model !== undefined ? { model: cfg.model } : {}),
        ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
      });
    }
    case 'mock': {
      const cfg = requireConfig(kind, configs.mock, 'configs.mock');
      if (cfg instanceof MockLlmProvider) return cfg;
      return new MockLlmProvider({ response: cfg.staticResponse });
    }
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      throw new LlmProviderError(
        // Cast through unknown — `kind` is `never` here, but we still
        // want a runtime-safe error message.
        kind as unknown as LlmProviderKind,
        `unknown provider kind: ${String(kind)}`,
        false,
      );
    }
  }
}
