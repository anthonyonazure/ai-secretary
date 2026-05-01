/**
 * MediaRecorder MIME negotiation. We prefer `audio/webm;codecs=opus` for
 * its small footprint and Whisper-compatible decode path; fall back to
 * `audio/mp4` (Safari), then `audio/webm`, then default. Surfacing the
 * chosen MIME lets the upload pipeline tag the chunk envelope correctly.
 */
export interface EncoderProfile {
  mimeType: string;
  bitsPerSecond: number;
  fileExtension: string;
}

export const PREFERRED_PROFILES: readonly EncoderProfile[] = [
  { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 96_000, fileExtension: 'webm' },
  { mimeType: 'audio/webm', bitsPerSecond: 96_000, fileExtension: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', bitsPerSecond: 96_000, fileExtension: 'm4a' },
  { mimeType: 'audio/mp4', bitsPerSecond: 96_000, fileExtension: 'm4a' },
  { mimeType: 'audio/ogg;codecs=opus', bitsPerSecond: 96_000, fileExtension: 'ogg' },
] as const;

/**
 * Returns the first profile whose MIME type the host MediaRecorder claims
 * to support. Returns `null` only if the host has no MediaRecorder at all
 * (very rare; Safari iOS pre-14.5 etc.) — caller should treat as a hard
 * "recording unsupported" condition.
 */
export function pickEncoderProfile(
  isTypeSupported: (mime: string) => boolean = defaultIsTypeSupported,
): EncoderProfile | null {
  if (!hasMediaRecorder()) return null;
  for (const profile of PREFERRED_PROFILES) {
    if (isTypeSupported(profile.mimeType)) return profile;
  }
  // Last-resort: an empty MIME means "use the platform default". The
  // caller can record without specifying a MIME and let the browser decide.
  return { mimeType: '', bitsPerSecond: 96_000, fileExtension: 'webm' };
}

export function hasMediaRecorder(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.MediaRecorder !== 'undefined';
}

function defaultIsTypeSupported(mime: string): boolean {
  if (!hasMediaRecorder()) return false;
  const ctor = globalThis.MediaRecorder;
  if (typeof ctor.isTypeSupported !== 'function') return false;
  try {
    return ctor.isTypeSupported(mime);
  } catch {
    return false;
  }
}
