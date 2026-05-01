/**
 * Streaming-friendly WAV header generator.
 *
 * The bot service streams 16kHz mono 16-bit PCM frames into S3 as a
 * multipart upload. The first part begins with a 44-byte WAV (RIFF/WAVE
 * + fmt + data) header followed by raw PCM bytes. Subsequent parts
 * append more PCM; no header is repeated.
 *
 * `dataLength` is unknown when the header is written. Common decoders
 * (ffmpeg, faster-whisper, OpenAI Whisper API after their internal
 * ffmpeg pass) accept a sentinel value and read until EOF. We use
 * `0xFFFFFFFE` (max - 1, well below an unsigned 32-bit overflow) and
 * apply the same value to the RIFF chunk size. The transcribe pipeline
 * already routes audio through ffmpeg before forwarding to the engine,
 * so the sentinel is normalized away upstream.
 *
 * If a future story wants exact lengths, the audio sink can buffer the
 * full WAV in memory + finalize the header at close-time, but that
 * trades off RAM (4h × 32 KB/s ≈ 460 MB) and latency for the
 * transcribe enqueue.
 */

const WAV_HEADER_BYTES = 44;
/**
 * Streaming sentinel for both the RIFF chunk size and `data` subchunk size.
 * Decoders that respect chunk boundaries treat this as "read until EOF".
 */
export const WAV_STREAMING_SIZE_SENTINEL = 0xfffffffe;

export interface WavHeaderOptions {
  sampleRate: number;
  channels: 1 | 2;
  bitsPerSample: 8 | 16 | 24 | 32;
  /**
   * Total length of the PCM payload in bytes. Pass
   * `WAV_STREAMING_SIZE_SENTINEL` for streaming uploads where the size
   * isn't known up front.
   */
  dataLength: number;
}

/**
 * Build a 44-byte canonical WAV header. Little-endian for all numeric
 * fields per the RIFF spec.
 */
export const wavHeader = (opts: WavHeaderOptions): Uint8Array => {
  const { sampleRate, channels, bitsPerSample, dataLength } = opts;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const buf = new ArrayBuffer(WAV_HEADER_BYTES);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // "RIFF"
  bytes[0] = 0x52;
  bytes[1] = 0x49;
  bytes[2] = 0x46;
  bytes[3] = 0x46;
  // RIFF chunk size = 36 + dataLength (or sentinel)
  const riffSize =
    dataLength === WAV_STREAMING_SIZE_SENTINEL ? WAV_STREAMING_SIZE_SENTINEL : 36 + dataLength;
  view.setUint32(4, riffSize, true);
  // "WAVE"
  bytes[8] = 0x57;
  bytes[9] = 0x41;
  bytes[10] = 0x56;
  bytes[11] = 0x45;
  // "fmt "
  bytes[12] = 0x66;
  bytes[13] = 0x6d;
  bytes[14] = 0x74;
  bytes[15] = 0x20;
  // Subchunk1 size (16 for PCM)
  view.setUint32(16, 16, true);
  // Audio format (1 = PCM)
  view.setUint16(20, 1, true);
  // Channels
  view.setUint16(22, channels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate
  view.setUint32(28, byteRate, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitsPerSample, true);
  // "data"
  bytes[36] = 0x64;
  bytes[37] = 0x61;
  bytes[38] = 0x74;
  bytes[39] = 0x61;
  // Subchunk2 size (data length, or sentinel)
  view.setUint32(40, dataLength, true);

  return bytes;
};
