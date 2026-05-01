/**
 * `ThumbsPrompt` — Story 1.7.
 *
 * Two-button "was this useful?" prompt that appears on first-three
 * receipts (and optionally elsewhere via the `context` prop). Records
 * the response in the local first-launch store + POSTs to
 * `/api/v1/feedback/thumbs` so the Growth-PM telemetry surface
 * (Story 1.8) has a server-side row to count.
 *
 * Once the user responds, the prompt collapses into a "thanks"
 * confirmation — the UX spec is explicit that the surface should not
 * persist a clickable retry; the response is one-shot.
 */

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import {
  type ThumbsResponseValue,
  useFirstLaunchStore,
  useHasRespondedToThumbs,
} from '../../../hooks/first-launch-store';
import { useAuth } from '../../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';

export interface ThumbsPromptProps {
  meetingId: string;
  /** Caller-tagged context for the telemetry payload. */
  context?: 'first-three' | 'general';
  /** Optional override for tests / Storybook. */
  fetchImpl?: typeof fetch;
}

type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error';

export function ThumbsPrompt({ meetingId, context = 'first-three', fetchImpl }: ThumbsPromptProps) {
  const recordThumbs = useFirstLaunchStore((s) => s.recordThumbs);
  const alreadyResponded = useHasRespondedToThumbs(meetingId);
  const { accessToken } = useAuth();

  const [state, setState] = useState<SubmitState>(alreadyResponded ? 'submitted' : 'idle');
  const [chosen, setChosen] = useState<ThumbsResponseValue | null>(null);

  const handleClick = async (response: ThumbsResponseValue) => {
    if (state !== 'idle') return;
    setState('submitting');
    setChosen(response);
    recordThumbs(meetingId, response);
    try {
      const fetcher = fetchImpl ?? globalThis.fetch.bind(globalThis);
      const baseUrl = resolveApiBaseUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetcher(`${baseUrl}/api/v1/feedback/thumbs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ meetingId, response, context }),
      });
      if (!res.ok && res.status !== 409) {
        // 409 (already recorded) is treated as success — the local
        // store and server agree.
        setState('error');
        return;
      }
      setState('submitted');
    } catch {
      setState('error');
    }
  };

  if (state === 'submitted') {
    return (
      <output
        data-testid="thumbs-prompt-submitted"
        className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 py-3 text-sm text-fg"
      >
        <span aria-hidden="true">✓</span>
        Thanks — that helps us tune what shows up next.
      </output>
    );
  }

  return (
    <div
      data-testid="thumbs-prompt"
      className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated px-4 py-3"
    >
      <p className="text-sm font-medium text-fg">Was this useful?</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleClick('up')}
          disabled={state === 'submitting'}
          aria-label="Yes, this was useful"
          aria-pressed={chosen === 'up'}
          data-testid="thumbs-prompt-up"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm font-medium text-fg transition hover:border-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => void handleClick('down')}
          disabled={state === 'submitting'}
          aria-label="No, this was not useful"
          aria-pressed={chosen === 'down'}
          data-testid="thumbs-prompt-down"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm font-medium text-fg transition hover:border-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          No
        </button>
      </div>
      {state === 'error' ? (
        <p className="text-xs text-fg" role="alert">
          Couldn’t save your feedback. We’ll try again next time.
        </p>
      ) : null}
    </div>
  );
}
