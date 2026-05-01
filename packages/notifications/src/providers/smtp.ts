import nodemailer, { type Transporter } from 'nodemailer';
import type { ProviderResult } from '../types.js';
import type { RenderedEmailMessage } from './postmark.js';

/**
 * SMTP email provider — on-prem default. Wraps `nodemailer`. Only file
 * in the workspace allowed to import `nodemailer`.
 */
export interface SmtpProviderConfig {
  host: string;
  port: number;
  /** TLS toggle. Use true for 465; false + STARTTLS upgrade for 587. */
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  defaultFrom: string;
  testMode?: boolean;
}

export class SmtpProvider {
  private readonly transporter: Transporter | null;
  private readonly defaultFrom: string;

  constructor(config: SmtpProviderConfig) {
    this.defaultFrom = config.defaultFrom;
    if (config.testMode) {
      this.transporter = null;
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.auth ? { auth: config.auth } : {}),
    });
  }

  async send(message: RenderedEmailMessage): Promise<ProviderResult> {
    if (!this.transporter) {
      return {
        ok: false,
        error: 'smtp provider in testMode — not configured to send',
        retryable: false,
      };
    }
    const fromAddr = message.from ?? this.defaultFrom;
    try {
      const info = await this.transporter.sendMail({
        from: fromAddr,
        to: message.toName ? `${message.toName} <${message.to}>` : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { ok: true, providerMessageId: info.messageId };
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errWithCode = err as { code?: string };
      // 5xx-class SMTP responses (bad recipient etc.) → not retryable.
      const permanentCodes = new Set(['EENVELOPE', 'EAUTH']);
      const retryable = !permanentCodes.has(errWithCode.code ?? '');
      return { ok: false, error: errMessage, retryable };
    }
  }
}
