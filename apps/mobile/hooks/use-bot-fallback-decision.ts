/**
 * `decideBotFallback` — Story 9.6 bot-failure recovery decision.
 *
 * When the meeting bot fails to join (or drops mid-meeting), the user
 * surface offers up to three recovery paths. Pick which one to lead
 * with based on:
 *   - Whether the meeting platform supports cloud recording
 *   - Whether the user has the cloud-recording entitlement enabled
 *   - Whether the meeting has already ended
 *   - Whether a manual upload is acceptable for the vertical (e.g.,
 *     clinical tenants block raw-audio uploads to avoid PHI sprawl)
 */

export type BotFailureKind =
  | 'failed-to-join'
  | 'dropped-mid-meeting'
  | 'platform-unsupported'
  | 'rate-limited';

export type BotPlatform = 'zoom' | 'teams' | 'meet' | 'unknown';

export type BotFallbackDecisionInput = {
  failureKind: BotFailureKind;
  platform: BotPlatform;
  meetingHasEnded: boolean;
  cloudRecordingEnabled: boolean;
  isClinicalVertical: boolean;
  hasReschedulePermission: boolean;
};

export type BotFallbackOption =
  | 'cloud-fetch'
  | 'manual-upload'
  | 'reschedule-bot'
  | 'manual-notes-only';

export type BotFallbackDecision = {
  primary: BotFallbackOption;
  alternates: ReadonlyArray<BotFallbackOption>;
  copy: string;
};

const PLATFORM_SUPPORTS_CLOUD: Record<BotPlatform, boolean> = {
  zoom: true,
  teams: true,
  meet: false,
  unknown: false,
};

export const decideBotFallback = (input: BotFallbackDecisionInput): BotFallbackDecision => {
  const platformCapable = PLATFORM_SUPPORTS_CLOUD[input.platform];
  const cloudAvailable = platformCapable && input.cloudRecordingEnabled;

  if (input.failureKind === 'platform-unsupported') {
    return {
      primary: input.isClinicalVertical ? 'manual-notes-only' : 'manual-upload',
      alternates: input.isClinicalVertical ? [] : ['manual-notes-only'],
      copy: 'This meeting platform isn’t supported. Use a different recovery option.',
    };
  }

  // Mid-meeting drop with cloud available + meeting still live → can
  // recover via reschedule (if permitted) since the bot still has time
  // to rejoin.
  if (
    input.failureKind === 'dropped-mid-meeting' &&
    !input.meetingHasEnded &&
    input.hasReschedulePermission
  ) {
    return {
      primary: 'reschedule-bot',
      alternates: cloudAvailable ? ['cloud-fetch', 'manual-notes-only'] : ['manual-notes-only'],
      copy: 'Bot connection dropped. Reconnecting now.',
    };
  }

  if (input.meetingHasEnded && cloudAvailable) {
    return {
      primary: 'cloud-fetch',
      alternates: input.isClinicalVertical ? [] : ['manual-upload'],
      copy: 'Meeting ended without a recording. Pull from cloud once it’s ready.',
    };
  }

  if (input.meetingHasEnded && !cloudAvailable && !input.isClinicalVertical) {
    return {
      primary: 'manual-upload',
      alternates: ['manual-notes-only'],
      copy: 'Bot didn’t capture this meeting. Upload the audio file if you have one.',
    };
  }

  if (input.meetingHasEnded && input.isClinicalVertical) {
    return {
      primary: 'manual-notes-only',
      alternates: [],
      copy: 'No recording captured. You can still write notes for this session.',
    };
  }

  if (input.failureKind === 'rate-limited') {
    return {
      primary: 'reschedule-bot',
      alternates: cloudAvailable ? ['cloud-fetch'] : [],
      copy: 'Bot service is busy. Trying again automatically.',
    };
  }

  return {
    primary: cloudAvailable ? 'cloud-fetch' : 'manual-notes-only',
    alternates: input.isClinicalVertical ? [] : ['manual-upload'],
    copy: 'Bot couldn’t join. Pick a recovery path.',
  };
};
