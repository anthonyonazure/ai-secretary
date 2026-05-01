import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError } from './errors.js';
import {
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type FinishReason,
  type LlmProvider,
} from './types.js';

/**
 * Anthropic-on-Bedrock provider.
 *
 * Used for:
 *   - HIPAA tenants (AWS BAA covers Bedrock + the underlying Anthropic
 *     model invocation; direct Anthropic API does not).
 *   - EU tenants (Bedrock eu-west-1 keeps inference inside the region).
 *   - Customer-managed-keys tenants (Bedrock supports KMS CMKs).
 *
 * Talks the Anthropic Messages API wire format wrapped in Bedrock's
 * InvokeModel envelope. Region + credentials come from the AWS SDK's
 * default credential chain (Railway sidecar IAM role / IRSA on
 * customer-cloud / static creds in dev). Region is configured via the
 * factory — NOT via process env at this layer (keeps the abstraction
 * test-friendly + lets one process talk to multiple regions).
 *
 * This is the ONLY file in the workspace allowed to import
 * `@aws-sdk/client-bedrock-runtime`. The provider-isolation grep
 * (`scripts/check-isolation.ts`) enforces this.
 */

const PROVIDER_KIND = 'bedrock' as const;
const DEFAULT_ANTHROPIC_VERSION = 'bedrock-2023-05-31';
/**
 * Default model id — Anthropic Sonnet 4.5 on Bedrock. Override via
 * `factory.bedrock.modelId` per-tenant if a customer requests a
 * specific Anthropic version (e.g. an Opus model for higher-stakes
 * summarization).
 */
const DEFAULT_MODEL_ID = 'anthropic.claude-sonnet-4-5-v1:0';

export interface BedrockProviderConfig {
  /** AWS region — `us-east-1` for HIPAA US, `eu-west-1` for EU tenants. */
  region: string;
  /** Bedrock model id, e.g. `anthropic.claude-sonnet-4-5-v1:0`. */
  modelId?: string;
  /** Override the per-call timeout (ms). Defaults to 60s. */
  timeoutMs?: number;
  /** Pre-built client (tests / customer-cloud BYOC where boot wires creds). */
  client?: BedrockRuntimeClient;
}

interface BedrockMessagePayload {
  anthropic_version: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
}

interface BedrockMessageBlock {
  type: string;
  text?: string;
}

interface BedrockMessageResponse {
  content: BedrockMessageBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface BedrockStreamChunkPayload {
  type: string;
  delta?: { type?: string; text?: string; stop_reason?: string };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
}

const splitSystemMessages = (
  messages: ChatMessage[],
): {
  system: string | undefined;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
} => {
  const systemParts: string[] = [];
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      conversation.push({ role: msg.role, content: msg.content });
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    conversation,
  };
};

const mapStopReason = (raw: string | null | undefined): FinishReason => {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool-use';
    case null:
    case undefined:
      return 'unknown';
    default:
      return 'unknown';
  }
};

const wrapBedrockError = (err: unknown, signalAborted: boolean, timeoutMs: number): Error => {
  if (signalAborted) return new LlmTimeoutError(timeoutMs, err);
  const e = err as {
    $metadata?: { httpStatusCode?: number; requestId?: string };
    name?: string;
    message?: string;
  };
  const status = e.$metadata?.httpStatusCode;
  const requestId = e.$metadata?.requestId;
  const message = e.message ?? String(err);

  // ThrottlingException / TooManyRequestsException → rate limit.
  if (status === 429 || e.name === 'ThrottlingException') {
    return new LlmRateLimitError(PROVIDER_KIND, undefined, err);
  }
  const retryable = status === undefined || status >= 500;
  return new LlmProviderError(PROVIDER_KIND, message, retryable, requestId, err);
};

const buildPayload = (input: ChatRequest): BedrockMessagePayload => {
  const { system, conversation } = splitSystemMessages(input.messages);
  return {
    anthropic_version: DEFAULT_ANTHROPIC_VERSION,
    max_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    ...(system !== undefined ? { system } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    messages: conversation,
  };
};

const decodeBytes = (bytes: Uint8Array | undefined): string => {
  if (!bytes) return '';
  return new TextDecoder().decode(bytes);
};

export class AnthropicBedrockProvider implements LlmProvider {
  readonly kind = PROVIDER_KIND;
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;
  private readonly timeoutMs: number;

  constructor(config: BedrockProviderConfig) {
    this.client = config.client ?? new BedrockRuntimeClient({ region: config.region });
    this.modelId = config.modelId ?? DEFAULT_MODEL_ID;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const payload = buildPayload(input);
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(payload)),
      });
      const response = await this.client.send(command, { abortSignal: controller.signal });
      const raw = decodeBytes(response.body as Uint8Array | undefined);
      const parsed = JSON.parse(raw) as BedrockMessageResponse;
      const text = (parsed.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text ?? '')
        .join('');
      return {
        text,
        inputTokens: parsed.usage?.input_tokens ?? 0,
        outputTokens: parsed.usage?.output_tokens ?? 0,
        finishReason: mapStopReason(parsed.stop_reason),
      };
    } catch (err) {
      throw wrapBedrockError(err, controller.signal.aborted, this.timeoutMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  async *chatStream(input: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    if (input.signal) {
      input.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: FinishReason = 'unknown';

    try {
      const payload = buildPayload(input);
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify(payload)),
      });
      const response = await this.client.send(command, { abortSignal: controller.signal });
      const stream = response.body;
      if (!stream) {
        yield { kind: 'error', error: 'bedrock returned empty stream' };
        return;
      }
      for await (const event of stream) {
        const chunkBytes = event.chunk?.bytes;
        if (!chunkBytes) continue;
        const text = decodeBytes(chunkBytes as Uint8Array);
        let parsed: BedrockStreamChunkPayload;
        try {
          parsed = JSON.parse(text) as BedrockStreamChunkPayload;
        } catch {
          continue;
        }
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens ?? 0;
          outputTokens = parsed.message.usage.output_tokens ?? 0;
        } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          const tokenText = parsed.delta.text ?? '';
          if (tokenText.length > 0) yield { kind: 'token', text: tokenText };
        } else if (parsed.type === 'message_delta') {
          if (parsed.delta?.stop_reason !== undefined) {
            finishReason = mapStopReason(parsed.delta.stop_reason);
          }
          if (parsed.usage?.output_tokens !== undefined) {
            outputTokens = parsed.usage.output_tokens;
          }
        }
      }
      yield { kind: 'done', inputTokens, outputTokens, finishReason };
    } catch (err) {
      const wrapped = wrapBedrockError(err, controller.signal.aborted, this.timeoutMs);
      yield { kind: 'error', error: wrapped.message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
