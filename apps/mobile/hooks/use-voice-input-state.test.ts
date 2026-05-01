import { describe, expect, it } from 'vitest';

import { deriveVoiceInputState } from './use-voice-input-state.js';

const baseInput = {
  permission: 'granted' as const,
  status: 'idle' as const,
  interim: '',
  final: [],
  isReducedMotion: false,
  errorKind: null,
};

describe('deriveVoiceInputState', () => {
  it('allows starting from idle with granted permission', () => {
    const r = deriveVoiceInputState(baseInput);
    expect(r.canStart).toBe(true);
    expect(r.canStop).toBe(false);
  });

  it('blocks start when permission is denied and surfaces the settings hint', () => {
    const r = deriveVoiceInputState({ ...baseInput, permission: 'denied' });
    expect(r.canStart).toBe(false);
    expect(r.bannerCopy).toMatch(/Microphone access/);
  });

  it('treats restricted (e.g., parental control) the same as denied', () => {
    const r = deriveVoiceInputState({ ...baseInput, permission: 'restricted' });
    expect(r.canStart).toBe(false);
  });

  it('shows waveform while listening when motion is enabled', () => {
    const r = deriveVoiceInputState({ ...baseInput, status: 'listening' });
    expect(r.showWaveform).toBe(true);
    expect(r.canStop).toBe(true);
  });

  it('hides waveform when reduced-motion is set', () => {
    const r = deriveVoiceInputState({
      ...baseInput,
      status: 'listening',
      isReducedMotion: true,
    });
    expect(r.showWaveform).toBe(false);
  });

  it('combines final + interim segments into the transcript', () => {
    const r = deriveVoiceInputState({
      ...baseInput,
      status: 'listening',
      final: ['Send the report'],
      interim: 'by Friday',
    });
    expect(r.combinedTranscript).toBe('Send the report by Friday');
  });

  it('routes "no-speech" error to a friendly copy', () => {
    const r = deriveVoiceInputState({
      ...baseInput,
      status: 'error',
      errorKind: 'no-speech',
    });
    expect(r.bannerCopy).toMatch(/Didn’t catch that/);
    expect(r.ariaLive).toBe('assertive');
  });

  it('routes "unsupported" error to a help copy', () => {
    const r = deriveVoiceInputState({
      ...baseInput,
      status: 'error',
      errorKind: 'unsupported',
    });
    expect(r.bannerCopy).toMatch(/isn’t supported/);
  });

  it('shows "Processing…" copy while processing', () => {
    const r = deriveVoiceInputState({ ...baseInput, status: 'processing' });
    expect(r.bannerCopy).toBe('Processing…');
  });
});
