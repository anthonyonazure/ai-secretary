/**
 * Web `MediaRecorder` wrapper. Owns the platform-specific side-effects:
 *   1. Permission request via getUserMedia
 *   2. MediaRecorder instantiation with negotiated MIME
 *   3. Chunk accumulation (in-memory) — final blob handed to the uploader
 *   4. Visibility-banner surface (iOS Safari mobile-web cannot record while
 *      the tab is hidden; we surface this so the UI can show a warning).
 *
 * Heartbeat (Story 4.4) will hook into the MediaRecorder `dataavailable`
 * event — when chunks are still landing the recording is alive. The
 * heartbeat publish itself lives outside this hook (separate concern).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasMediaRecorder, pickEncoderProfile } from '../lib/recording/audio-encoder';

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface UseRecordingOptions {
  /** Slice MediaRecorder timeslice in ms — defaults to 1000ms for chunk granularity. */
  timesliceMs?: number;
  /** Override `getUserMedia` for tests. */
  getStream?: () => Promise<MediaStream>;
}

export interface UseRecordingApi {
  isSupported: boolean;
  isVisible: boolean;
  start: () => Promise<{ deviceName?: string }>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<RecordingResult>;
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingApi {
  const { timesliceMs = 1000 } = options;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const profileRef = useRef<{ mimeType: string } | null>(null);
  const [isVisible, setIsVisible] = useState(() => readVisibility());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setIsVisible(readVisibility());
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const isSupported = typeof navigator !== 'undefined' && hasMediaRecorder();

  const start = useCallback(async (): Promise<{ deviceName?: string }> => {
    if (!isSupported) throw new Error('Recording is not supported in this browser');
    const stream = options.getStream
      ? await options.getStream()
      : await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const profile = pickEncoderProfile();
    if (!profile) throw new Error('No supported audio MIME type for MediaRecorder');
    profileRef.current = { mimeType: profile.mimeType };

    const init: MediaRecorderOptions = {};
    if (profile.mimeType) init.mimeType = profile.mimeType;
    if (profile.bitsPerSecond) init.audioBitsPerSecond = profile.bitsPerSecond;
    const recorder = new MediaRecorder(stream, init);
    chunksRef.current = [];
    recorder.addEventListener('dataavailable', (event) => {
      const blobEvent = event as BlobEvent;
      if (blobEvent.data && blobEvent.data.size > 0) {
        chunksRef.current.push(blobEvent.data);
      }
    });
    recorder.start(timesliceMs);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();

    const track = stream.getAudioTracks()[0];
    const deviceName = track?.label ?? undefined;
    return deviceName !== undefined ? { deviceName } : {};
  }, [isSupported, options, timesliceMs]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.pause();
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'paused') recorder.resume();
  }, []);

  const stop = useCallback((): Promise<RecordingResult> => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return Promise.reject(new Error('No active recording to stop'));
    }
    return new Promise<RecordingResult>((resolve, reject) => {
      const handleStop = () => {
        try {
          const mimeType = profileRef.current?.mimeType ?? recorder.mimeType ?? 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const durationMs = Date.now() - startedAtRef.current;
          chunksRef.current = [];
          recorderRef.current = null;
          if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) track.stop();
            streamRef.current = null;
          }
          resolve({ blob, mimeType, durationMs });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      recorder.addEventListener('stop', handleStop, { once: true });
      try {
        recorder.stop();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }, []);

  return { isSupported, isVisible, start, pause, resume, stop };
}

function readVisibility(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}
