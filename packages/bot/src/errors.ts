/**
 * Typed error hierarchy for the bot package.
 *
 * Worker handlers catch `BotError` (the base class) and transition the
 * session to `failed` with the `failure_reason` recorded. Other
 * exception types are bugs — let them propagate.
 */

export class BotError extends Error {
  override readonly name: string = 'BotError';
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

/**
 * Provider isn't usable in this environment — typically because the
 * required credentials (Zoom S2S OAuth, Teams Graph app secret) aren't
 * configured. Surfaced by the Zoom + Teams skeletons until creds land.
 */
export class BotProviderUnavailableError extends BotError {
  override readonly name: string = 'BotProviderUnavailableError';
  constructor(
    public readonly providerKind: string,
    public readonly missing: readonly string[],
  ) {
    super(
      `[${providerKind}] provider unavailable: missing ${missing.join(', ')}. Wire credentials in apps/bot/src/index.ts before instantiating.`,
    );
  }
}

export class BotJoinTimeoutError extends BotError {
  override readonly name: string = 'BotJoinTimeoutError';
  constructor(timeoutMs: number, cause?: unknown) {
    super(`Bot join timed out after ${timeoutMs}ms`, cause);
  }
}

export class BotJoinRefusedError extends BotError {
  override readonly name: string = 'BotJoinRefusedError';
  constructor(
    public readonly providerKind: string,
    message: string,
    cause?: unknown,
  ) {
    super(`[${providerKind}] join refused: ${message}`, cause);
  }
}

/**
 * Connection lost mid-meeting (network drop, host kicked the bot,
 * meeting ended without graceful leave). Worker transitions the session
 * to `failed` and surfaces a `bot-join-failed` notification with the
 * recoverable reason.
 */
export class BotConnectionLostError extends BotError {
  override readonly name: string = 'BotConnectionLostError';
}

/**
 * The FSM rejected an attempted state transition. Programmer error —
 * caller tried to `markJoined` on an already-failed session, etc.
 */
export class BotStateTransitionError extends BotError {
  override readonly name: string = 'BotStateTransitionError';
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid bot session transition: ${from} → ${to}`);
  }
}
