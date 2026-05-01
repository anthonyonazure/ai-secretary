/**
 * MockBotProvider — deterministic, in-memory provider used by tests and
 * the dev shell.
 *
 * Behavior:
 *   - `join()` resolves after `joinDelayMs` (default 0) with a synthetic
 *     handle. To exercise the failure path, set `joinShouldFail` (or
 *     pass `'refused'` / `'timeout'` to pick an error class).
 *   - `subscribeAudio()` immediately starts emitting scripted frames at
 *     `frameIntervalMs`. By default it emits one 16kHz silence frame
 *     every 100ms; override `audioScript` to inject specific frames.
 *   - `leave()` is idempotent.
 *   - `getParticipants()` returns the configured roster.
 *
 * The mock NEVER touches the network. The script-driven audio loop runs
 * on `setInterval`; consumers MUST call `unsubscribe()` (or `leave()`)
 * to stop it — important inside test runners that fail on dangling
 * timers.
 */

import { BotJoinRefusedError, BotJoinTimeoutError } from '../errors.js';
import type {
  BotAudioFrame,
  BotAudioListener,
  BotAudioSubscription,
  BotJoinHandle,
  BotJoinRequest,
  BotJoinResult,
  BotParticipant,
  BotProvider,
} from '../types.js';

export type MockJoinFailure = 'refused' | 'timeout';

export interface MockBotProviderOptions {
  /** Wall-clock delay before `join()` resolves. Default 0. */
  joinDelayMs?: number;
  /** When set, `join()` rejects with the matching error. Default: success. */
  joinShouldFail?: MockJoinFailure;
  /** Roster the provider returns from `join()` + `getParticipants()`. */
  participants?: BotParticipant[];
  /** Audio frame cadence. Default 100ms. */
  frameIntervalMs?: number;
  /**
   * Override the auto-generated silence frames with a fixed script.
   * Each call to `subscribeAudio` cycles through the script in order;
   * pass an empty array to suppress all audio.
   */
  audioScript?: ReadonlyArray<Omit<BotAudioFrame, 'sessionId'>>;
  /**
   * Wall-clock the provider stamps on `joinedAt`. Test seam.
   * Default: `new Date()` at join-resolution time.
   */
  now?: () => Date;
}

const DEFAULT_PARTICIPANTS: BotParticipant[] = [
  { externalId: 'mock-user-1', displayName: 'Alice Mock', email: 'alice@example.com' },
  { externalId: 'mock-user-2', displayName: 'Bob Mock', email: 'bob@example.com' },
];

const FRAME_DURATION_MS = 20;

const buildSilenceFrame = (offsetMs: number): Omit<BotAudioFrame, 'sessionId'> => {
  const sampleRate = 16000;
  const sampleCount = Math.floor((sampleRate * FRAME_DURATION_MS) / 1000);
  return {
    timestampMs: offsetMs,
    pcm: new Uint8Array(sampleCount * 2),
    sampleRate,
    channels: 1,
    speakerExternalId: null,
  };
};

interface MockHandlePayload {
  sessionId: string;
}

export class MockBotProvider implements BotProvider {
  readonly kind = 'mock' as const;

  private readonly opts: {
    joinDelayMs: number;
    joinShouldFail: MockJoinFailure | undefined;
    participants: BotParticipant[];
    frameIntervalMs: number;
    audioScript: ReadonlyArray<Omit<BotAudioFrame, 'sessionId'>> | undefined;
    now: () => Date;
  };

  /** Tracks active timers so `unsubscribe`/`leave` can stop them deterministically. */
  private readonly timersBySession = new Map<string, Set<ReturnType<typeof setInterval>>>();

  constructor(opts: MockBotProviderOptions = {}) {
    this.opts = {
      joinDelayMs: opts.joinDelayMs ?? 0,
      joinShouldFail: opts.joinShouldFail,
      participants: opts.participants ?? DEFAULT_PARTICIPANTS,
      frameIntervalMs: opts.frameIntervalMs ?? 100,
      audioScript: opts.audioScript,
      now: opts.now ?? (() => new Date()),
    };
  }

  async join(req: BotJoinRequest): Promise<BotJoinResult> {
    if (this.opts.joinDelayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.opts.joinDelayMs);
      });
    }

    if (this.opts.joinShouldFail === 'refused') {
      throw new BotJoinRefusedError('mock', `mock provider refused join for ${req.sessionId}`);
    }
    if (this.opts.joinShouldFail === 'timeout') {
      throw new BotJoinTimeoutError(this.opts.joinDelayMs);
    }

    const payload: MockHandlePayload = { sessionId: req.sessionId };
    return {
      handle: { sessionId: req.sessionId, providerHandle: payload },
      joinedAt: this.opts.now(),
      participants: [...this.opts.participants],
    };
  }

  async subscribeAudio(
    handle: BotJoinHandle,
    listener: BotAudioListener,
  ): Promise<BotAudioSubscription> {
    const script = this.opts.audioScript;
    let cursor = 0;
    let offsetMs = 0;

    const tick = () => {
      const frame: Omit<BotAudioFrame, 'sessionId'> = (() => {
        if (script) {
          if (script.length === 0) return buildSilenceFrame(offsetMs);
          const f = script[cursor % script.length];
          cursor += 1;
          return f as Omit<BotAudioFrame, 'sessionId'>;
        }
        return buildSilenceFrame(offsetMs);
      })();
      offsetMs += this.opts.frameIntervalMs;
      try {
        const ret = listener({ ...frame, sessionId: handle.sessionId });
        if (ret && typeof (ret as Promise<void>).then === 'function') {
          (ret as Promise<void>).catch(() => {
            /* swallow async listener errors; the caller owns retry policy */
          });
        }
      } catch {
        /* swallow synchronous listener errors; keep emitting */
      }
    };

    const interval = setInterval(tick, this.opts.frameIntervalMs);
    const set = this.timersBySession.get(handle.sessionId) ?? new Set();
    set.add(interval);
    this.timersBySession.set(handle.sessionId, set);

    let stopped = false;
    return {
      unsubscribe: async () => {
        if (stopped) return;
        stopped = true;
        clearInterval(interval);
        const stored = this.timersBySession.get(handle.sessionId);
        stored?.delete(interval);
        if (stored && stored.size === 0) this.timersBySession.delete(handle.sessionId);
      },
    };
  }

  async leave(handle: BotJoinHandle): Promise<void> {
    const stored = this.timersBySession.get(handle.sessionId);
    if (stored) {
      for (const t of stored) clearInterval(t);
      this.timersBySession.delete(handle.sessionId);
    }
  }

  async getParticipants(_handle: BotJoinHandle): Promise<BotParticipant[]> {
    return [...this.opts.participants];
  }
}
