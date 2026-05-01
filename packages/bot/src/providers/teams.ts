/**
 * TeamsBotProvider — skeleton.
 *
 * Real implementation needs:
 *   - Azure AD app registration (tenant ID + client ID + client secret)
 *     with admin-consented application permissions:
 *       OnlineMeetings.ReadWrite.All, Calls.JoinGroupCall.All,
 *       CallRecords.Read.All
 *   - Microsoft Graph Communications API + media bot infra. The
 *     `@microsoft/microsoft-graph-client` + Communications SDK imports
 *     land in this file and ONLY in this file. The CI isolation gate
 *     (scripts/check-isolation.ts) guards that boundary.
 *   - Media stream subscription: the Communications SDK exposes a media
 *     stack callback at 16kHz mono PCM, 20ms frames. The provider
 *     republishes via `BotAudioListener`.
 *
 * Until those land, the constructor throws `BotProviderUnavailableError`
 * on instantiation when any required credential is missing.
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

export interface TeamsBotProviderConfig {
  azureTenantId: string;
  clientId: string;
  clientSecret: string;
  /** Region the Graph app + media bot are deployed to. */
  region: Region;
  /** Display name the bot uses in the meeting roster. */
  defaultDisplayName?: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof TeamsBotProviderConfig> = [
  'azureTenantId',
  'clientId',
  'clientSecret',
  'region',
];

const validateConfig = (config: Partial<TeamsBotProviderConfig>): readonly string[] => {
  const missing: string[] = [];
  for (const k of REQUIRED_FIELDS) {
    const v = config[k];
    if (v === undefined || v === null || v === '') missing.push(k);
  }
  return missing;
};

export class TeamsBotProvider implements BotProvider {
  readonly kind = 'teams' as const;

  constructor(_config: TeamsBotProviderConfig) {
    const missing = validateConfig(_config);
    if (missing.length > 0) {
      throw new BotProviderUnavailableError('teams', missing);
    }
  }

  async join(_req: BotJoinRequest): Promise<BotJoinResult> {
    throw new BotProviderUnavailableError('teams', ['microsoft-graph-communications']);
  }

  async subscribeAudio(
    _handle: BotJoinHandle,
    _listener: BotAudioListener,
  ): Promise<BotAudioSubscription> {
    throw new BotProviderUnavailableError('teams', ['microsoft-graph-communications']);
  }

  async leave(_handle: BotJoinHandle): Promise<void> {
    throw new BotProviderUnavailableError('teams', ['microsoft-graph-communications']);
  }

  async getParticipants(_handle: BotJoinHandle): Promise<BotParticipant[]> {
    throw new BotProviderUnavailableError('teams', ['microsoft-graph-communications']);
  }
}
