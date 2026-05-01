import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { ProviderResult, PushPayload, PushRecipient } from '../types.js';

/**
 * Expo push provider — wraps `expo-server-sdk`. Single instance per
 * worker; the SDK manages chunking + rate limiting internally.
 *
 * NOTE: this is the only file in the workspace allowed to import
 * `expo-server-sdk`. The CI isolation script (`scripts/check-isolation.ts`)
 * fails the build if the import surfaces elsewhere.
 */
export interface ExpoPushProviderConfig {
  /** Optional access token for Expo's push receipts API. */
  accessToken?: string;
  /**
   * If true, suppress the actual SDK init (used in tests where the
   * provider is constructed but never sends).
   */
  testMode?: boolean;
}

export class ExpoPushProvider {
  private readonly expo: Expo | null;

  constructor(config: ExpoPushProviderConfig = {}) {
    this.expo = config.testMode
      ? null
      : new Expo(config.accessToken ? { accessToken: config.accessToken } : {});
  }

  /**
   * Sends a single push payload to one recipient (which may have
   * multiple device tokens — they all get the same message). Returns
   * one combined `ProviderResult` even when multiple tickets come back;
   * the gateway treats partial-failure as overall-failure to keep the
   * audit-log + retry semantics simple.
   */
  async send(recipient: PushRecipient, payload: PushPayload): Promise<ProviderResult> {
    if (!this.expo) {
      return {
        ok: false,
        error: 'expo-push provider in testMode — not configured to send',
        retryable: false,
      };
    }

    const validTokens = recipient.pushTokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) {
      return { ok: false, error: 'no valid expo push tokens for recipient', retryable: false };
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    try {
      const tickets: ExpoPushTicket[] = [];
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      }

      const errorTicket = tickets.find((t) => t.status === 'error');
      if (errorTicket && errorTicket.status === 'error') {
        const isInvalidToken = errorTicket.details?.error === 'DeviceNotRegistered';
        return {
          ok: false,
          error: errorTicket.message,
          retryable: !isInvalidToken,
        };
      }

      // SDK returns a per-message ticket; we surface the first id as the
      // canonical providerMessageId. Receipts API can correlate later.
      const okTicket = tickets.find((t) => t.status === 'ok');
      const providerMessageId = okTicket && okTicket.status === 'ok' ? okTicket.id : 'unknown';
      return { ok: true, providerMessageId };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    }
  }
}
