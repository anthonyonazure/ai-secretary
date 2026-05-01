/**
 * `@aisecretary/llm-gateway` — provider-agnostic LLM abstraction.
 *
 * Public surface (consumers should NOT reach into individual provider
 * files; everything is re-exported from this index for stability):
 *
 *   - Contracts: `LlmProvider`, `ChatRequest`, `ChatResponse`,
 *     `ChatStreamEvent`, `ChatMessage`, `LlmProviderKind`, `FinishReason`.
 *   - Selector:  `selectProviderKindForTenant({ region, compliancePosture })`.
 *   - Factory:   `createLlmProvider({ kind, configs })`.
 *   - Gateway:   `LlmGateway({ tenant, configs, enableFallback?, auditLogger? })`.
 *   - Implementations: `AnthropicProvider`, `OpenAiProvider`,
 *     `AzureOpenAiProvider`, `AnthropicBedrockProvider`,
 *     `OllamaProvider`, `MockLlmProvider`.
 *   - Errors: `LlmError`, `LlmTimeoutError`, `LlmRateLimitError`,
 *     `LlmProviderError`, `LlmSchemaParseError`.
 *
 * Provider-abstraction discipline (CLAUDE.md): the `@anthropic-ai/sdk`
 * and `@aws-sdk/client-bedrock-runtime` packages are imported only
 * inside this package. The `openai` SDK is shared between this package
 * and `packages/transcription` (the only two allowed importers). The
 * grep gate at `scripts/check-isolation.ts` fails CI on violations.
 */

export const PACKAGE_NAME = '@aisecretary/llm-gateway';

export * from './types.js';
export * from './errors.js';
export * from './selector.js';
export type { TenantLlmContext, ProviderPreference } from './selector.js';
export * from './factory.js';
export type { LlmProviderConfigs, CreateLlmProviderOpts } from './factory.js';
export * from './gateway.js';
export type { LlmGatewayDeps, LlmAuditEntry, LlmAuditLogger } from './gateway.js';

export { AnthropicProvider } from './anthropic.js';
export type { AnthropicProviderConfig } from './anthropic.js';
export { OpenAiProvider } from './openai.js';
export type { OpenAiProviderConfig } from './openai.js';
export { AzureOpenAiProvider } from './azure-openai.js';
export type { AzureOpenAiProviderConfig } from './azure-openai.js';
export { AnthropicBedrockProvider } from './bedrock.js';
export type { BedrockProviderConfig } from './bedrock.js';
export { OllamaProvider } from './ollama.js';
export type { OllamaProviderConfig } from './ollama.js';
export { MockLlmProvider } from './mock.js';
export type { MockLlmProviderOptions, MockResponseFn } from './mock.js';
