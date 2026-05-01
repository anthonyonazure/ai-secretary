/**
 * expo-audio recording config — quality preset + format hints.
 * `expo-audio` exposes `RecordingPresets.HIGH_QUALITY` (m4a / aac on iOS +
 * Android, webm/opus on web). The high-quality preset matches what the
 * upload pipeline + Whisper expect. Surfacing the preset behind a
 * named constant keeps the call sites readable + testable without
 * importing the expo runtime in pure-logic units.
 */
import { type RecordingOptions, RecordingPresets } from 'expo-audio';

export interface MobileEncoderProfile {
  preset: RecordingOptions;
  fileExtension: 'm4a';
  mimeType: 'audio/mp4';
}

export const DEFAULT_PROFILE: MobileEncoderProfile = {
  preset: RecordingPresets.HIGH_QUALITY ?? ({} as RecordingOptions),
  fileExtension: 'm4a',
  mimeType: 'audio/mp4',
};
