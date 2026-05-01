/**
 * Public contract for the meeting-bot provider abstraction.
 *
 * Producer-side counterpart to the receive-side substrate that's already
 * shipped:
 *   - `apps/workers/src/handlers/bot-watchdog.ts` consumes the heartbeat
 *     keyed `bot:<sessionId>` and enqueues `bot-join-failed` on loss.
 *   - `packages/notifications` declares the `bot-join-failed` kind.
 *   - `apps/api/src/lib/sse-events.ts` registers the `bot.join-failed`
 *     SSE event.
 *
 * Bot sessions move through a 4-state FSM (`fsm.ts`):
 *   provisioning → joined → ended         (clean leave)
 *   provisioning → failed                  (join refused / cred error)
 *   joined        → failed                 (lost connection / aborted)
 *
 * `failed` is the audit-visible terminal that drives the user-facing
 * "bot couldn't join" notification + the cloud-recording fallback path
 * (Story 9.6).
 *
 * Provider isolation (CLAUDE.md): the Zoom Meeting SDK + Microsoft Graph
 * Communications SDK imports stay inside this package. `scripts/
 * check-isolation.ts` is the CI gate.
 */

/**
 * Source platform — drives provider selection, audit copy, and the
 * `bot-join-failed` notification copy ("Zoom" vs "Teams"). Mirrors the
 * column on the (forthcoming) `bot_sessions` table and the `source`
 * field on `apps/workers/src/handlers/bot-watchdog.ts`.
 */
export type BotSource = 'zoom_bot' | 'teams_bot';

/** Discriminator returned by every provider — useful for logging + tests. */
export type BotProviderKind = 'zoom' | 'teams' | 'mock';

/**
 * FSM states. The `bot-watchdog` handler treats `provisioning` and
 * `joined` as in-flight (sends heartbeats expected); `ended` and
 * `failed` are terminal.
 */
export type BotSessionStatus = 'provisioning' | 'joined' | 'ended' | 'failed';

export type Region = 'us' | 'eu';

/**
 * Snapshot of a bot session as the worker loop sees it. The DB row in
 * `bot_sessions` stores a superset; this is the in-process shape the
 * FSM + provider operate on.
 */
export interface BotSession {
  sessionId: string;
  tenantId: string;
  ownerUserId: string;
  meetingId: string | null;
  source: BotSource;
  region: Region;
  /**
   * Provider-native meeting handle. For Zoom: the meeting number /
   * join URL. For Teams: the online-meeting ID or join URL. Opaque
   * to the FSM.
   */
  externalMeetingId: string;
  /** Optional pre-shared passcode. Zoom requires it for password-gated meetings. */
  externalMeetingPasscode?: string;
  status: BotSessionStatus;
  joinedAt: Date | null;
  endedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input to `BotProvider.join()`. The provider returns a `BotJoinHandle`
 * that the worker uses for subsequent `subscribeAudio` / `leave` calls.
 */
export interface BotJoinRequest {
  sessionId: string;
  tenantId: string;
  externalMeetingId: string;
  externalMeetingPasscode?: string;
  /** Display name the bot uses in the meeting roster. */
  displayName: string;
  /**
   * Disclosure text spoken on join + posted to chat. Localized
   * upstream; the provider just plays/sends it.
   */
  disclosureText: string;
  /** AbortSignal — when the worker decides to abort the join attempt. */
  signal?: AbortSignal;
}

export interface BotJoinHandle {
  sessionId: string;
  /** Provider-internal handle. Opaque to the FSM. */
  providerHandle: unknown;
}

export interface BotJoinResult {
  handle: BotJoinHandle;
  /** Wall-clock when the bot actually joined the meeting. */
  joinedAt: Date;
  /** Roster snapshot at join time, if the provider exposes one. */
  participants: BotParticipant[];
}

export interface BotParticipant {
  /** Provider-native participant id. Stable for the duration of the meeting. */
  externalId: string;
  /** Display name shown in the meeting roster. */
  displayName: string;
  /**
   * Optional email of the participant (Zoom + Teams both expose this
   * in many cases). Used by the diarization-to-user matcher upstream.
   */
  email?: string;
}

/**
 * One slice of captured audio. The bot service emits frames at the
 * provider's natural cadence (Zoom: 10ms PCM, Teams: 20ms PCM). The
 * worker buffers + chunk-uploads them via the existing `recordings`
 * pipeline (decision pending; see HANDOFF.md).
 *
 * `pcm` is mono 16-bit signed little-endian PCM. `sampleRate` is
 * normally 16000 (Zoom + Teams both default), but the provider is free
 * to upsample/downsample at the source.
 */
export interface BotAudioFrame {
  sessionId: string;
  timestampMs: number;
  pcm: Uint8Array;
  sampleRate: number;
  channels: 1;
  /**
   * Provider-native participant id — present when the SDK can attribute
   * the frame to a single speaker; null for mixed buses or when the
   * provider only exposes a downmixed track.
   */
  speakerExternalId: string | null;
}

/**
 * Subscriber callback. Throwing from the listener tears down the
 * subscription; the provider should log + transition the session to
 * `failed` if that happens.
 */
export type BotAudioListener = (frame: BotAudioFrame) => void | Promise<void>;

export interface BotAudioSubscription {
  /** Stops audio delivery; idempotent. */
  unsubscribe(): Promise<void>;
}

export interface BotProvider {
  readonly kind: BotProviderKind;
  /** Join the meeting. Resolves on `joined`; rejects on join failure. */
  join(req: BotJoinRequest): Promise<BotJoinResult>;
  /** Subscribe to PCM audio frames for an in-flight session. */
  subscribeAudio(handle: BotJoinHandle, listener: BotAudioListener): Promise<BotAudioSubscription>;
  /** Leave cleanly. Idempotent; resolves once the bot has departed. */
  leave(handle: BotJoinHandle): Promise<void>;
  /** Roster snapshot. */
  getParticipants(handle: BotJoinHandle): Promise<BotParticipant[]>;
}

/**
 * Default cadence for heartbeats published from the worker side. Mirror
 * of `apps/workers/src/handlers/bot-watchdog.ts` expectations:
 *   - SETEX TTL 90s
 *   - watchdog scans every 15s
 *   - heartbeat every 30s
 */
export const BOT_HEARTBEAT_INTERVAL_MS = 30_000;
export const BOT_HEARTBEAT_TTL_SECONDS = 90;

/**
 * Default join timeout. Both Zoom + Teams typically resolve in <5s on
 * the happy path; we give 60s to allow lobby admit + retry.
 */
export const DEFAULT_BOT_JOIN_TIMEOUT_MS = 60_000;
