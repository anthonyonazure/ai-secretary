import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Story 4.6 — live captions during recording (deaf / HoH accessibility).
 *
 * The locked spec says captions feed from the same transcription
 * pipeline (`packages/transcription`). Today that pipeline is post-
 * upload only — the worker transcribes the finished recording. Until
 * the streaming-transcription path lands (Story 2.x follow-up), this
 * hook bridges the gap with the browser's built-in `webkitSpeechRecognition`
 * (Chrome / Safari / Edge) so deaf + HoH users get captions immediately
 * when they're recording.
 *
 * When the streaming server-side path lands, swap the transport here
 * and every consuming surface picks up the upgrade — no API churn.
 */

export type LiveCaptionsState =
  | { kind: 'idle' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'starting' }
  | { kind: 'listening'; partial: string; finalText: string }
  | { kind: 'error'; reason: string };

export interface UseLiveCaptionsApi {
  state: LiveCaptionsState;
  start(): void;
  stop(): void;
  /** Most recent finalized transcript text — useful for surfacing in
   *  the receipt's accessibility-mode caption rail after recording. */
  finalText: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

const resolveRecognition = ():
  | { kind: 'ok'; ctor: new () => SpeechRecognitionLike }
  | { kind: 'no'; reason: string } => {
  if (typeof window === 'undefined') {
    return { kind: 'no', reason: 'Captions need a browser environment.' };
  }
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!ctor) {
    return {
      kind: 'no',
      reason:
        'This browser does not support live captions. Try Chrome, Edge, or Safari for live captions, or rely on the post-recording transcript.',
    };
  }
  return { kind: 'ok', ctor };
};

export function useLiveCaptions(language = 'en-US'): UseLiveCaptionsApi {
  const [state, setState] = useState<LiveCaptionsState>({ kind: 'idle' });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  const start = useCallback(() => {
    const resolved = resolveRecognition();
    if (resolved.kind === 'no') {
      setState({ kind: 'unsupported', reason: resolved.reason });
      return;
    }
    if (recognitionRef.current) return; // Already started.

    setState({ kind: 'starting' });
    finalRef.current = '';

    const rec = new resolved.ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0].transcript;
        if (result.isFinal) {
          finalRef.current = `${finalRef.current}${text}`.trim();
        } else {
          interim += text;
        }
      }
      setState({ kind: 'listening', partial: interim.trim(), finalText: finalRef.current });
    };
    rec.onerror = (event) => {
      setState({ kind: 'error', reason: event.error || 'speech-recognition-error' });
    };
    rec.onend = () => {
      // SpeechRecognition stops aggressively on silence; if we're still
      // marked as listening, restart it to keep the captions live.
      if (recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* ignore — `stop()` race */
        }
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      setState({ kind: 'error', reason: (err as Error).message });
    }
  }, [language]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    recognitionRef.current = null;
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
    setState({ kind: 'idle' });
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return {
    state,
    start,
    stop,
    finalText: finalRef.current,
  };
}
