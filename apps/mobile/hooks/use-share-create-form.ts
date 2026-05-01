import {
  MAX_CLIP_DURATION_MS,
  MIN_CLIP_DURATION_MS,
  validateClipBounds,
} from '@aisecretary/shared';

export type ShareKind = 'meeting' | 'clip' | 'insight' | 'token-url';

export type ShareCreateInput = {
  kind: ShareKind;
  recipientEmail: string;
  expiryDays: number;
  clipStartMs: number | null;
  clipEndMs: number | null;
  recordingDurationMs: number;
  insightModuleId: string | null;
};

export type ShareCreateBlocker =
  | 'recipient-required'
  | 'invalid-email'
  | 'expiry-out-of-range'
  | 'clip-bounds-invalid'
  | 'clip-too-short'
  | 'clip-too-long'
  | 'clip-past-end'
  | 'insight-module-required';

export type ShareCreateState = {
  canSubmit: boolean;
  blockers: ReadonlyArray<ShareCreateBlocker>;
  durationMs: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 90;

export const deriveShareCreateState = (input: ShareCreateInput): ShareCreateState => {
  const blockers: ShareCreateBlocker[] = [];
  let durationMs = 0;

  if (input.kind === 'token-url') {
    // No recipient required; URL is the credential.
  } else {
    if (input.recipientEmail.trim().length === 0) {
      blockers.push('recipient-required');
    } else if (!EMAIL_RE.test(input.recipientEmail.trim())) {
      blockers.push('invalid-email');
    }
  }

  if (input.expiryDays < MIN_EXPIRY_DAYS || input.expiryDays > MAX_EXPIRY_DAYS) {
    blockers.push('expiry-out-of-range');
  }

  if (input.kind === 'clip') {
    if (input.clipStartMs === null || input.clipEndMs === null) {
      blockers.push('clip-bounds-invalid');
    } else {
      const r = validateClipBounds({
        startMs: input.clipStartMs,
        endMs: input.clipEndMs,
        recordingDurationMs: input.recordingDurationMs,
      });
      durationMs = r.durationMs;
      if (r.violations.includes('too-short')) blockers.push('clip-too-short');
      if (r.violations.includes('too-long')) blockers.push('clip-too-long');
      if (r.violations.includes('past-recording-end')) blockers.push('clip-past-end');
      if (r.violations.includes('end-before-start') || r.violations.includes('start-negative')) {
        blockers.push('clip-bounds-invalid');
      }
    }
  }

  if (input.kind === 'insight' && (input.insightModuleId ?? '').length === 0) {
    blockers.push('insight-module-required');
  }

  return {
    canSubmit: blockers.length === 0,
    blockers,
    durationMs,
  };
};

export const SHARE_CREATE_LIMITS = {
  minExpiryDays: MIN_EXPIRY_DAYS,
  maxExpiryDays: MAX_EXPIRY_DAYS,
  minClipMs: MIN_CLIP_DURATION_MS,
  maxClipMs: MAX_CLIP_DURATION_MS,
};
