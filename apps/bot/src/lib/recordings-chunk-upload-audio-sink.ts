/**
 * `RecordingsChunkUploadAudioSink` — production audio sink for the bot
 * service.
 *
 * Bot-captured PCM frames flow into the existing `recordings` chunk-
 * upload pipeline so the same transcribe → speaker_turns → analysis
 * path runs unchanged. The seam:
 *
 *   1. `open(input)`:
 *      a. mint `recordingId`
 *      b. compute storage key (`tenants/<tenantId>/recordings/<id>.wav`)
 *      c. `storage.createMultipartUpload(...)` — get `uploadId`
 *      d. `recordingsRepository.create(...)` — row in `'uploading'`
 *      e. seed the in-memory part buffer with a streaming-WAV header
 *
 *   2. `write(frame)`:
 *      a. append `frame.pcm` to the buffer
 *      b. when buffer ≥ `partThresholdBytes` flush as the next part:
 *         `storage.uploadPart(...)` → captures `etag`, advances
 *         `partNumber`
 *
 *   3. `close()`:
 *      a. flush trailing buffer as the final part (S3 allows the last
 *         part to be < 5 MB; intermediate parts must be ≥ 5 MB so the
 *         default threshold is 5 MB exactly)
 *      b. `storage.completeMultipartUpload(...)`
 *      c. `recordingsRepository.markUploaded(...)`
 *      d. `transcribeEnqueuer.enqueue(...)` — feeds the same handler
 *         that mobile/web uploads use
 *
 *   On error in any step, the sink calls `storage.abortMultipartUpload`
 *   + `recordingsRepository.markFailed` and rethrows; the bot-join
 *   handler maps that into the FSM's `failed` transition.
 *
 * The interfaces below are local-minimal slices of the API repository +
 * transcribe-enqueuer types so this file doesn't import from `apps/api`.
 * Structural typing makes the concrete classes from
 * `apps/api/src/routes/recordings-repository.ts` /
 * `apps/api/src/lib/transcribe-enqueue.ts` compatible at the wiring
 * site (`apps/bot/src/index.ts` future production boot).
 */

import { randomUUID } from 'node:crypto';
import type { BotAudioFrame, Region } from '@aisecretary/bot';
import type { MultipartPart, StorageProvider } from '@aisecretary/storage';

import type { AudioSink, AudioSinkHandle, AudioSinkOpenInput } from './audio-sink.js';
import { WAV_STREAMING_SIZE_SENTINEL, wavHeader } from './wav-encoder.js';

/**
 * Minimal subset of `RecordingsRepository` the sink needs. The concrete
 * impl in `apps/api/src/routes/recordings-repository.ts` exposes a
 * wider surface (markTranscribing / markCompleted / findById); we keep
 * only what the producer-side write path requires.
 */
export interface RecordingsSinkWriter {
  create(input: {
    id?: string;
    tenantId: string;
    meetingId?: string | null;
    ownerUserId: string;
    storageKey: string;
    contentType: string;
    sizeBytes?: number | null;
    s3UploadId: string;
  }): Promise<{ id: string; tenantId: string }>;
  markUploaded(input: { recordingId: string; tenantId: string }): Promise<unknown>;
  markFailed(input: {
    recordingId: string;
    tenantId: string;
    reason: string;
  }): Promise<unknown>;
}

/**
 * Minimal subset of `TranscribeEnqueuer`. Mirrors
 * `apps/api/src/lib/transcribe-enqueue.ts`.
 */
export interface BotTranscribeEnqueuer {
  enqueue(payload: {
    recordingId: string;
    tenantId: string;
    region: Region;
  }): Promise<string | null>;
}

export interface RecordingsChunkUploadAudioSinkOptions {
  storage: StorageProvider;
  recordingsRepository: RecordingsSinkWriter;
  transcribeEnqueuer: BotTranscribeEnqueuer;
  /**
   * Buffer size that triggers a part flush. Default 5 MiB so
   * non-final parts honor S3's 5 MB minimum. Tests pin a tiny value.
   */
  partThresholdBytes?: number;
  /** PCM format params. Bot providers emit 16kHz mono 16-bit by default. */
  audioFormat?: {
    sampleRate: number;
    channels: 1 | 2;
    bitsPerSample: 8 | 16 | 24 | 32;
  };
  /** Test seam — pin the recordingId factory. */
  recordingIdFactory?: () => string;
}

const DEFAULT_PART_THRESHOLD_BYTES = 5 * 1024 * 1024;

const DEFAULT_AUDIO_FORMAT = {
  sampleRate: 16_000,
  channels: 1 as const,
  bitsPerSample: 16 as const,
};

const buildStorageKey = (tenantId: string, recordingId: string): string =>
  `tenants/${tenantId}/recordings/${recordingId}.wav`;

const concatBuffers = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
};

class RecordingsChunkUploadHandle implements AudioSinkHandle {
  private buffer: Uint8Array;
  private partNumber = 0;
  private readonly parts: MultipartPart[] = [];
  private closed = false;
  private failed = false;

  constructor(
    private readonly opts: {
      recordingId: string;
      storageKey: string;
      uploadId: string;
      tenantId: string;
      region: Region;
      partThresholdBytes: number;
      storage: StorageProvider;
      recordingsRepository: RecordingsSinkWriter;
      transcribeEnqueuer: BotTranscribeEnqueuer;
      contentType: string;
      headerBytes: Uint8Array;
    },
  ) {
    // Part 1 begins with the WAV header; subsequent parts are pure PCM.
    this.buffer = opts.headerBytes;
  }

  async write(frame: BotAudioFrame): Promise<void> {
    if (this.closed || this.failed) return;
    this.buffer = concatBuffers(this.buffer, frame.pcm);
    if (this.buffer.byteLength >= this.opts.partThresholdBytes) {
      await this.flushPart();
    }
  }

  private async flushPart(): Promise<void> {
    if (this.buffer.byteLength === 0) return;
    this.partNumber += 1;
    const body = this.buffer;
    this.buffer = new Uint8Array(0);
    try {
      const result = await this.opts.storage.uploadPart({
        key: this.opts.storageKey,
        uploadId: this.opts.uploadId,
        partNumber: this.partNumber,
        body,
        contentType: this.opts.contentType,
      });
      this.parts.push(result);
    } catch (err) {
      this.failed = true;
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      // Flush trailing PCM (last part may be < 5MB).
      await this.flushPart();
      if (this.parts.length === 0) {
        // No frames written at all (header-only) — abort + mark failed.
        await this.opts.storage.abortMultipartUpload({
          key: this.opts.storageKey,
          uploadId: this.opts.uploadId,
        });
        await this.opts.recordingsRepository.markFailed({
          recordingId: this.opts.recordingId,
          tenantId: this.opts.tenantId,
          reason: 'no-audio-frames-captured',
        });
        return;
      }
      await this.opts.storage.completeMultipartUpload({
        key: this.opts.storageKey,
        uploadId: this.opts.uploadId,
        parts: this.parts,
      });
      await this.opts.recordingsRepository.markUploaded({
        recordingId: this.opts.recordingId,
        tenantId: this.opts.tenantId,
      });
      await this.opts.transcribeEnqueuer.enqueue({
        recordingId: this.opts.recordingId,
        tenantId: this.opts.tenantId,
        region: this.opts.region,
      });
    } catch (err) {
      this.failed = true;
      // Best-effort cleanup on partial failure: abort + mark failed.
      await this.opts.storage
        .abortMultipartUpload({
          key: this.opts.storageKey,
          uploadId: this.opts.uploadId,
        })
        .catch(() => {
          /* swallow — abort failure is best-effort during close cleanup */
        });
      await this.opts.recordingsRepository
        .markFailed({
          recordingId: this.opts.recordingId,
          tenantId: this.opts.tenantId,
          reason: err instanceof Error ? err.message : 'audio-sink-close-failed',
        })
        .catch(() => {
          /* swallow — DB write failure here would be re-thrown anyway */
        });
      throw err;
    }
  }
}

export class RecordingsChunkUploadAudioSink implements AudioSink {
  private readonly opts: Required<
    Omit<RecordingsChunkUploadAudioSinkOptions, 'recordingIdFactory'>
  > & {
    recordingIdFactory: () => string;
  };

  constructor(options: RecordingsChunkUploadAudioSinkOptions) {
    this.opts = {
      storage: options.storage,
      recordingsRepository: options.recordingsRepository,
      transcribeEnqueuer: options.transcribeEnqueuer,
      partThresholdBytes: options.partThresholdBytes ?? DEFAULT_PART_THRESHOLD_BYTES,
      audioFormat: options.audioFormat ?? DEFAULT_AUDIO_FORMAT,
      recordingIdFactory: options.recordingIdFactory ?? randomUUID,
    };
  }

  async open(input: AudioSinkOpenInput): Promise<AudioSinkHandle> {
    const recordingId = this.opts.recordingIdFactory();
    const storageKey = buildStorageKey(input.tenantId, recordingId);
    const contentType = 'audio/wav';
    const init = await this.opts.storage.createMultipartUpload(storageKey, { contentType });
    await this.opts.recordingsRepository.create({
      id: recordingId,
      tenantId: input.tenantId,
      meetingId: input.meetingId,
      ownerUserId: input.ownerUserId,
      storageKey,
      contentType,
      s3UploadId: init.uploadId,
    });
    const headerBytes = wavHeader({
      sampleRate: this.opts.audioFormat.sampleRate,
      channels: this.opts.audioFormat.channels,
      bitsPerSample: this.opts.audioFormat.bitsPerSample,
      dataLength: WAV_STREAMING_SIZE_SENTINEL,
    });
    return new RecordingsChunkUploadHandle({
      recordingId,
      storageKey,
      uploadId: init.uploadId,
      tenantId: input.tenantId,
      region: input.region,
      partThresholdBytes: this.opts.partThresholdBytes,
      storage: this.opts.storage,
      recordingsRepository: this.opts.recordingsRepository,
      transcribeEnqueuer: this.opts.transcribeEnqueuer,
      contentType,
      headerBytes,
    });
  }
}
