/**
 * ZoomBotProvider — skeleton.
 *
 * Real implementation needs:
 *   - Zoom Server-to-Server OAuth (account ID + client ID + client
 *     secret, scoped per region)
 *   - Zoom Meeting SDK (or the C++ Linux meeting SDK fronted by the
 *     `@zoom/meetingsdk` Node bindings) — the SDK import lands in this
 *     file and ONLY in this file. The CI isolation gate (scripts/
 *     check-isolation.ts) guards that boundary.
 *   - Real-time audio capture: the SDK exposes a raw-audio callback at
 *     16kHz mono PCM, 10ms frames. The provider buffers + republishes
 *     them via `BotAudioListener`.
 *
 * Until those land, the constructor throws `BotProviderUnavailableError`
 * on instantiation when any required credential is missing. That keeps
 * the factory path honest: either you get a working provider or a fast,
 * audited failure at selection time.
 */

import { BotProviderUnavailableError } from '../errors.js';
import type {
  BotAudioListener,
  BotAudioSubscription,
  BotJoinHandle,
  BotJoinRequest,
  BotJoinResult,
  BotParticipant,
  BotProvider,
  Region,
} from '../types.js';

export interface ZoomBotProviderConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  /** Region the OAuth app is scoped to. */
  region: Region;
  /**
   * Display name the bot uses in the meeting roster. Falls back to the
   * `BotJoinRequest.displayName` if omitted.
   */
  defaultDisplayName?: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof ZoomBotProviderConfig> = [
  'accountId',
  'clientId',
  'clientSecret',
  'region',
];

const validateConfig = (config: Partial<ZoomBotProviderConfig>): readonly string[] => {
  const missing: string[] = [];
  for (const k of REQUIRED_FIELDS) {
    const v = config[k];
    if (v === undefined || v === null || v === '') missing.push(k);
  }
  return missing;
};

export class ZoomBotProvider implements BotProvider {
  readonly kind = 'zoom' as const;

  constructor(_config: ZoomBotProviderConfig) {
    const missing = validateConfig(_config);
    if (missing.length > 0) {
      throw new BotProviderUnavailableError('zoom', missing);
    }
    // Real implementation: store config + lazily init the SDK on first
    // `join()`. Skeleton intentionally omits the SDK import.
  }

  async join(_req: BotJoinRequest): Promise<BotJoinResult> {
    throw new BotProviderUnavailableError('zoom', ['zoom-meeting-sdk-binding']);
  }

  async subscribeAudio(
    _handle: BotJoinHandle,
    _listener: BotAudioListener,
  ): Promise<BotAudioSubscription> {
    throw new BotProviderUnavailableError('zoom', ['zoom-meeting-sdk-binding']);
  }

  async leave(_handle: BotJoinHandle): Promise<void> {
    throw new BotProviderUnavailableError('zoom', ['zoom-meeting-sdk-binding']);
  }

  async getParticipants(_handle: BotJoinHandle): Promise<BotParticipant[]> {
    throw new BotProviderUnavailableError('zoom', ['zoom-meeting-sdk-binding']);
  }
}
