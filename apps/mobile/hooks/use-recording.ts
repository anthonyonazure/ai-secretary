/**
 * Expo recording wrapper. Owns:
 *   - Mic permission request
 *   - `useAudioRecorder` lifecycle (record / pause / stop)
 *   - Surfacing the resulting file URI for the upload pipeline
 *
 * Story 4.4 (heartbeat): the `RECORDING_STATUS_UPDATE` event from
 * expo-audio is the natural pulse — `recorder.getStatus()` returns the
 * `currentTime`, which we'll publish over HTTP at 30s cadence. The hook
 * surface here exposes `recorder` so a sibling hook can subscribe.
 */

import {
  type RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setIsAudioActiveAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useRef } from 'react';

export interface MobileRecordingResult {
  uri: string;
  mimeType: string;
  durationMs: number;
}

export interface UseRecordingApi {
  start: () => Promise<{ deviceName?: string }>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<MobileRecordingResult>;
}

const HIGH_QUALITY_PRESET: RecordingOptions =
  (RecordingPresets.HIGH_QUALITY as RecordingOptions | undefined) ?? ({} as RecordingOptions);

export function useRecording(): UseRecordingApi {
  const recorder = useAudioRecorder(HIGH_QUALITY_PRESET);
  const startedAtRef = useRef<number>(0);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission denied');
    }
    await setIsAudioActiveAsync(true);
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAtRef.current = Date.now();
    return {} as { deviceName?: string };
  }, [recorder]);

  const pause = useCallback(() => {
    if (recorder.isRecording) recorder.pause();
  }, [recorder]);

  const resume = useCallback(() => {
    if (!recorder.isRecording) recorder.record();
  }, [recorder]);

  const stop = useCallback(async (): Promise<MobileRecordingResult> => {
    await recorder.stop();
    await setIsAudioActiveAsync(false);
    const uri = recorder.uri ?? '';
    const durationMs = Date.now() - startedAtRef.current;
    return { uri, mimeType: 'audio/mp4', durationMs };
  }, [recorder]);

  return { start, pause, resume, stop };
}
