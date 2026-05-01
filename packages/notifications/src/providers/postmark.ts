import { ServerClient } from 'postmark';
import type { ProviderResult } from '../types.js';

/**
 * Postmark email provider — SaaS default. Wraps the official `postmark`
 * SDK. Only file in the workspace allowed to import `postmark`.
 */
export interface PostmarkProviderConfig {
  apiToken: string;
  defaultFrom: string;
  testMode?: boolean;
}

export interface RenderedEmailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export class PostmarkProvider {
  private readonly client: ServerClient | null;
  private readonly defaultFrom: string;

  constructor(config: PostmarkProviderConfig) {
    this.client = config.testMode ? null : new ServerClient(config.apiToken);
    this.defaultFrom = config.defaultFrom;
  }

  async send(message: RenderedEmailMessage): Promise<ProviderResult> {
    if (!this.client) {
      return {
        ok: false,
        error: 'postmark provider in testMode — not configured to send',
        retryable: false,
      };
    }
    const fromAddr = message.from ?? this.defaultFrom;
    try {
      const result = await this.client.sendEmail({
        From: fromAddr,
        To: message.toName ? `${message.toName} <${message.to}>` : message.to,
        Subject: message.subject,
        HtmlBody: message.html,
        TextBody: message.text,
        MessageStream: 'outbound',
      });
      return { ok: true, providerMessageId: result.MessageID };
    } catch (err) {
      // Postmark surfaces ApiInputError with code 422 for validation
      // failures (bad recipient, etc.) — those should NOT retry.
      const message = err instanceof Error ? err.message : String(err);
      const errorWithCode = err as { code?: number };
      const retryable = errorWithCode.code !== 422 && errorWithCode.code !== 401;
      return { ok: false, error: message, retryable };
    }
  }
}
