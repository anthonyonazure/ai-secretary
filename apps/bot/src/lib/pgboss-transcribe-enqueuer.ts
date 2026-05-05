/**
 * pg-boss-backed `BotTranscribeEnqueuer` — production impl of the
 * transcribe-handoff seam the `RecordingsChunkUploadAudioSink` uses
 * after multipart upload completion.
 *
 * Sends a job onto the same `transcribe` queue mobile + web uploads
 * use, so the bot-captured audio runs the existing transcription →
 * speaker_turns → analysis pipeline unchanged.
 */

import type { Region } from '@aisecretary/db';
import type PgBoss from 'pg-boss';

import type { BotTranscribeEnqueuer } from './recordings-chunk-upload-audio-sink.js';

export const TRANSCRIBE_QUEUE = 'transcribe';

export interface PgBossTranscribeEnqueuerOptions {
  boss: PgBoss;
  /** Override the queue name (tests). Defaults to `transcribe`. */
  queueName?: string;
}

export class PgBossTranscribeEnqueuer implements BotTranscribeEnqueuer {
  constructor(private readonly options: PgBossTranscribeEnqueuerOptions) {}

  async enqueue(payload: {
    recordingId: string;
    tenantId: string;
    region: Region;
  }): Promise<string | null> {
    const queue = this.options.queueName ?? TRANSCRIBE_QUEUE;
    const id = await this.options.boss.send(queue, payload);
    return id ?? null;
  }
}
