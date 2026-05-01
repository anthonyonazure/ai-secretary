import { describe, expect, it } from 'vitest';

import { applyDiarizeExclude, buildParticipantDecisions } from './diarize-exclude.js';
import type { TranscriptionSegment } from './types.js';

const seg = (speaker: string | null, text = 't'): TranscriptionSegment => ({
  startMs: 0,
  endMs: 1000,
  text,
  confidence: 0.9,
  speaker,
});

describe('applyDiarizeExclude', () => {
  it('passes through untagged (null-speaker) turns regardless of policy', () => {
    const segs = [seg(null, 'silence-buffer'), seg('spk_0', 'hello')];
    const result = applyDiarizeExclude(segs, {
      bySpeaker: { spk_0: 'declined' },
      fallback: 'suppress',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('silence-buffer');
  });

  it('suppresses turns from declined speakers', () => {
    const segs = [seg('spk_0', 'a'), seg('spk_1', 'b'), seg('spk_2', 'c')];
    const result = applyDiarizeExclude(segs, {
      bySpeaker: { spk_0: 'accepted', spk_1: 'declined', spk_2: 'expired-no-response' },
      fallback: 'include',
    });
    expect(result.map((s) => s.text)).toEqual(['a']);
  });

  it('falls back to include when the policy is legitimate-interest', () => {
    const segs = [seg('spk_0', 'a'), seg('spk_99', 'unknown')];
    const result = applyDiarizeExclude(segs, {
      bySpeaker: { spk_0: 'accepted' },
      fallback: 'include',
    });
    expect(result.map((s) => s.text)).toEqual(['a', 'unknown']);
  });

  it('falls back to suppress when the policy is explicit-consent', () => {
    const segs = [seg('spk_0', 'a'), seg('spk_99', 'unknown')];
    const result = applyDiarizeExclude(segs, {
      bySpeaker: { spk_0: 'accepted' },
      fallback: 'suppress',
    });
    expect(result.map((s) => s.text)).toEqual(['a']);
  });

  it('does not mutate the input', () => {
    const segs = [seg('spk_0', 'a')];
    const cloned = JSON.parse(JSON.stringify(segs));
    applyDiarizeExclude(segs, { bySpeaker: { spk_0: 'declined' }, fallback: 'include' });
    expect(segs).toEqual(cloned);
  });
});

describe('buildParticipantDecisions', () => {
  it('rolls up rows into a speaker-keyed map', () => {
    const decisions = buildParticipantDecisions(
      [
        { speakerLabel: 'spk_0', decision: 'accepted' },
        { speakerLabel: 'spk_1', decision: 'declined' },
      ],
      'legitimate-interest',
    );
    expect(decisions.bySpeaker).toEqual({ spk_0: 'accepted', spk_1: 'declined' });
    expect(decisions.fallback).toBe('include');
  });

  it('selects suppress fallback for explicit-consent policy', () => {
    const decisions = buildParticipantDecisions([], 'explicit-consent');
    expect(decisions.fallback).toBe('suppress');
  });
});
