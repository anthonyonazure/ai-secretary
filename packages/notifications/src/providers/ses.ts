import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { ProviderResult } from '../types.js';
import type { RenderedEmailMessage } from './postmark.js';

/**
 * AWS SES email provider — SaaS fallback. Only file in the workspace
 * allowed to import `@aws-sdk/client-ses`.
 */
export interface SesProviderConfig {
  region: string;
  defaultFrom: string;
  /** Optional explicit credentials; otherwise SDK uses AWS default chain. */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  testMode?: boolean;
}

export class SesProvider {
  private readonly client: SESClient | null;
  private readonly defaultFrom: string;

  constructor(config: SesProviderConfig) {
    this.defaultFrom = config.defaultFrom;
    if (config.testMode) {
      this.client = null;
      return;
    }
    this.client = new SESClient({
      region: config.region,
      ...(config.credentials ? { credentials: config.credentials } : {}),
    });
  }

  async send(message: RenderedEmailMessage): Promise<ProviderResult> {
    if (!this.client) {
      return {
        ok: false,
        error: 'ses provider in testMode — not configured to send',
        retryable: false,
      };
    }
    const fromAddr = message.from ?? this.defaultFrom;
    try {
      const response = await this.client.send(
        new SendEmailCommand({
          Source: fromAddr,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: message.html, Charset: 'UTF-8' },
              Text: { Data: message.text, Charset: 'UTF-8' },
            },
          },
        }),
      );
      return { ok: true, providerMessageId: response.MessageId ?? 'unknown' };
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errWithName = err as { name?: string };
      // Permanent failures: bad address, sending paused, no permissions.
      const permanentNames = new Set([
        'MessageRejected',
        'MailFromDomainNotVerifiedException',
        'ConfigurationSetDoesNotExistException',
      ]);
      const retryable = !permanentNames.has(errWithName.name ?? '');
      return { ok: false, error: errMessage, retryable };
    }
  }
}
