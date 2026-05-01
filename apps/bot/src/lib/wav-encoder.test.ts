import { describe, expect, it } from 'vitest';

import { WAV_STREAMING_SIZE_SENTINEL, wavHeader } from './wav-encoder.js';

describe('wavHeader', () => {
  it('emits a 44-byte canonical RIFF/WAVE/fmt/data header', () => {
    const header = wavHeader({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      dataLength: 32_000,
    });
    expect(header.byteLength).toBe(44);
    // RIFF
    expect(String.fromCharCode(header[0]!, header[1]!, header[2]!, header[3]!)).toBe('RIFF');
    // WAVE
    expect(String.fromCharCode(header[8]!, header[9]!, header[10]!, header[11]!)).toBe('WAVE');
    // fmt
    expect(String.fromCharCode(header[12]!, header[13]!, header[14]!, header[15]!)).toBe('fmt ');
    // data
    expect(String.fromCharCode(header[36]!, header[37]!, header[38]!, header[39]!)).toBe('data');
  });

  it('encodes sample rate / byte rate / channels little-endian', () => {
    const header = wavHeader({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      dataLength: 32_000,
    });
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint32(28, true)).toBe(16000 * 1 * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits/sample
    expect(view.getUint32(40, true)).toBe(32_000); // data length
  });

  it('writes 36 + dataLength to the RIFF chunk size', () => {
    const header = wavHeader({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      dataLength: 1_000,
    });
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint32(4, true)).toBe(36 + 1_000);
  });

  it('writes the streaming sentinel to BOTH RIFF chunk size and data subchunk size when dataLength is the sentinel', () => {
    const header = wavHeader({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      dataLength: WAV_STREAMING_SIZE_SENTINEL,
    });
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint32(4, true)).toBe(WAV_STREAMING_SIZE_SENTINEL);
    expect(view.getUint32(40, true)).toBe(WAV_STREAMING_SIZE_SENTINEL);
  });

  it('handles stereo + 24-bit', () => {
    const header = wavHeader({
      sampleRate: 48000,
      channels: 2,
      bitsPerSample: 24,
      dataLength: 100,
    });
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(24);
    expect(view.getUint16(32, true)).toBe(2 * 3); // block align
    expect(view.getUint32(28, true)).toBe(48000 * 2 * 3); // byte rate
  });
});
