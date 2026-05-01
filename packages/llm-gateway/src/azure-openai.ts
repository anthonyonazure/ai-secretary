import OpenAI from 'openai';
import { OpenAiProvider } from './openai.js';
import {
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  DEFAULT_LLM_TIMEOUT_MS,
  type LlmProvider,
} from './types.js';

/**
 * Azure OpenAI provider.
 *
 * Same `openai` SDK as `OpenAiProvider` but pointed at an Azure
 * deployment via `baseURL` + `defaultHeaders.api-key`. The Azure URL
 * shape is `https://{resource}.openai.azure.com/openai/deployments/{deployment}`
 * and Azure expects an `api-version` query string on every request,
 * which we set as a default param.
 *
 * Used for HIPAA tenants (Azure OpenAI HIPAA-eligible deployment) and
 * EU tenants (Azure OpenAI EU resource). The HIPAA tier requires Azure
 * BAA + a separate "abuse-monitoring opt-out" — that's a deployment
 * config concern, not a code concern; this provider just talks to
 * whatever deployment the env points it at.
 */

const PROVIDER_KIND = 'azure-openai' as const;
const DEFAULT_API_VERSION = '2024-08-01-preview';

export interface AzureOpenAiProviderConfig {
  apiKey: string;
  /**
   * Azure OpenAI resource endpoint, e.g. `https://my-resource.openai.azure.com`.
   * The provider appends `/openai/deployments/{deployment}` automatically.
   */
  endpoint: string;
  /** Deployment name configured on the Azure OpenAI resource. */
  deployment: string;
  /** API version — defaults to a recent GA-compatible preview. */
  apiVersion?: string;
  /** Override the per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  /** Pre-built client (tests). When provided, the other fields are ignored. */
  client?: OpenAI;
}

const buildAzureClient = (config: AzureOpenAiProviderConfig): OpenAI => {
  const baseURL = `${config.endpoint.replace(/\/+$/, '')}/openai/deployments/${config.deployment}`;
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL,
    defaultQuery: { 'api-version': config.apiVersion ?? DEFAULT_API_VERSION },
    defaultHeaders: { 'api-key': config.apiKey },
  });
};

export class AzureOpenAiProvider extends OpenAiProvider implements LlmProvider {
  override readonly kind: 'azure-openai' = PROVIDER_KIND;

  constructor(config: AzureOpenAiProviderConfig) {
    // Azure routes by deployment name in the path; the OpenAI SDK still
    // wants a `model` field in the request body, but Azure ignores it
    // and uses the deployment in the URL. We pass the deployment name
    // as the model so logs are still readable.
    super({
      apiKey: config.apiKey,
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      model: config.deployment,
      client: config.client ?? buildAzureClient(config),
    });
    // Re-set timeoutMs so the parent's default applies if absent.
    if (config.timeoutMs === undefined) {
      // Parent already set DEFAULT_LLM_TIMEOUT_MS; nothing to do.
      void DEFAULT_LLM_TIMEOUT_MS;
    }
  }

  // chat / chatStream inherited from OpenAiProvider — the only
  // observable difference is `kind === 'azure-openai'` (used by audit
  // log + error wrapping) and the URL/auth wiring above.
  override async chat(input: ChatRequest): Promise<ChatResponse> {
    return super.chat(input);
  }

  override async *chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent> {
    yield* super.chatStream(input);
  }
}
