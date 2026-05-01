/**
 * Audio sink — abstracts over where bot-captured PCM frames go.
 *
 * Producer-side decision (chunk 2 + 3): bot frames flow into the
 * existing `recordings` chunk-upload pipeline. The real implementation
 * (chunk 3.5) wires this against `apps/api/src/lib/recording-chunk-poster`
 * so the audio path is identical to mobile/web recording captures —
 * same transcribe queue, same speaker_turns table, same retention.
 *
 * The seam exists now so the bot-join handler can be tested end-to-end
 * with a mock sink that captures frames into an array.
 */

import type { BotAudioFrame, Region } from '@aisecretary/bot';

export interface AudioSinkOpenInput {
  sessionId: string;
  tenantId: string;
  meetingId: string | null;
  ownerUserId: string;
  region: Region;
}

export interface AudioSinkHandle {
  write(frame: BotAudioFrame): Promise<void>;
  /** Idempotent. Flushes any in-flight chunks. */
  close(): Promise<void>;
}

export interface AudioSink {
  open(input: AudioSinkOpenInput): Promise<AudioSinkHandle>;
}

/**
 * In-memory sink for tests — every frame is appended to `frames`. The
 * handle's `write` resolves immediately; `close` is a no-op.
 */
export class InMemoryAudioSink implements AudioSink {
  public readonly opens: AudioSinkOpenInput[] = [];
  public readonly frames: BotAudioFrame[] = [];
  public readonly closes: number[] = [];

  async open(input: AudioSinkOpenInput): Promise<AudioSinkHandle> {
    this.opens.push(input);
    const sink = this;
    let closed = false;
    return {
      async write(frame: BotAudioFrame) {
        if (closed) return;
        sink.frames.push(frame);
      },
      async close() {
        if (closed) return;
        closed = true;
        sink.closes.push(sink.frames.length);
      },
    };
  }
}
