/**
 * `@aisecretary/transcription` — provider-agnostic speech-to-text.
 *
 * Public surface (consumers should NOT reach into individual provider
 * files; everything is re-exported from this index for stability):
 *
 *   - Contracts: `TranscriptionProvider`, `TranscriptionRequest`,
 *     `TranscriptionResult`, `TranscriptionSegment`, `TranscriptionEngineKind`.
 *   - Factory:   `createTranscriptionProvider({ kind, whisperApi?, fasterWhisper? })`.
 *   - Selector:  `selectProviderKindForTenant({ region, compliancePosture })`.
 *   - Implementations: `WhisperApiProvider`, `FasterWhisperProvider`,
 *     `MockTranscriptionProvider`.
 *   - Errors:    `TranscriptionError`, `TranscriptionProviderError`,
 *     `TranscriptionTimeoutError`.
 *
 * Provider-abstraction discipline (CLAUDE.md): the `openai` SDK is
 * imported only inside this package (whisper-api.ts). Faster-whisper
 * uses plain `fetch`. The grep gate at `scripts/check-isolation.ts`
 * fails CI if either surfaces outside `packages/transcription`.
 */

export const PACKAGE_NAME = '@aisecretary/transcription';

export * from './types.js';
export * from './errors.js';
export * from './selector.js';
export * from './factory.js';
export { WhisperApiProvider, logprobToConfidence } from './whisper-api.js';
export type { WhisperApiProviderConfig } from './whisper-api.js';
export { FasterWhisperProvider } from './faster-whisper.js';
export type { FasterWhisperProviderConfig } from './faster-whisper.js';
export { MockTranscriptionProvider } from './mock.js';
export type { MockTranscriptionProviderOptions } from './mock.js';
export {
  MockDiarizationProvider,
  PyannoteHttpDiarizationProvider,
  mergeDiarization,
  selectDiarizationStrategy,
} from './diarization.js';
export { applyDiarizeExclude, buildParticipantDecisions } from './diarize-exclude.js';
export type { ConsentDecision, ParticipantDecisions } from './diarize-exclude.js';
export type {
  DiarizationProvider,
  DiarizationProviderKind,
  DiarizationRegion,
  DiarizationRequest,
  DiarizationResult,
  PyannoteHttpDiarizationProviderConfig,
} from './diarization.js';
