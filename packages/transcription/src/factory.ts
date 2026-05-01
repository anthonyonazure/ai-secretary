import { TranscriptionProviderError } from './errors.js';
import { FasterWhisperProvider } from './faster-whisper.js';
import type { TranscriptionEngineKind, TranscriptionProvider } from './types.js';
import { WhisperApiProvider } from './whisper-api.js';

/**
 * Factory: pick the concrete `TranscriptionProvider` for the kind the
 * selector returned. Worker boot wires this into the handler factory so
 * test harnesses can inject a mock instead.
 *
 * Failure modes:
 *   - `kind === 'whisper-api'` but `whisperApi.apiKey` missing → throw.
 *   - `kind === 'faster-whisper'` but `fasterWhisper.endpoint` missing → throw.
 *
 * The handler in `apps/workers/src/handlers/transcribe.ts` catches the
 * missing-config case at boot and falls back to a mock provider with a
 * loud warning, so dev/CI runs don't require either API key.
 */

export interface CreateTranscriptionProviderConfig {
  kind: TranscriptionEngineKind;
  whisperApi?: { apiKey: string; baseURL?: string; timeoutMs?: number };
  fasterWhisper?: { endpoint: string; authToken?: string; timeoutMs?: number };
}

export function createTranscriptionProvider(
  opts: CreateTranscriptionProviderConfig,
): TranscriptionProvider {
  switch (opts.kind) {
    case 'whisper-api': {
      if (!opts.whisperApi?.apiKey) {
        throw new TranscriptionProviderError(
          'whisper-api',
          'createTranscriptionProvider({ kind: "whisper-api" }) requires whisperApi.apiKey',
        );
      }
      return new WhisperApiProvider({
        apiKey: opts.whisperApi.apiKey,
        ...(opts.whisperApi.baseURL !== undefined ? { baseURL: opts.whisperApi.baseURL } : {}),
        ...(opts.whisperApi.timeoutMs !== undefined
          ? { timeoutMs: opts.whisperApi.timeoutMs }
          : {}),
      });
    }
    case 'faster-whisper': {
      if (!opts.fasterWhisper?.endpoint) {
        throw new TranscriptionProviderError(
          'faster-whisper',
          'createTranscriptionProvider({ kind: "faster-whisper" }) requires fasterWhisper.endpoint',
        );
      }
      return new FasterWhisperProvider({
        endpoint: opts.fasterWhisper.endpoint,
        ...(opts.fasterWhisper.authToken !== undefined
          ? { authToken: opts.fasterWhisper.authToken }
          : {}),
        ...(opts.fasterWhisper.timeoutMs !== undefined
          ? { timeoutMs: opts.fasterWhisper.timeoutMs }
          : {}),
      });
    }
    default: {
      const _exhaustive: never = opts.kind;
      void _exhaustive;
      throw new TranscriptionProviderError(
        String(opts.kind),
        `unknown transcription engine kind: ${String(opts.kind)}`,
      );
    }
  }
}
