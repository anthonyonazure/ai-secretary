/**
 * `/chat` — RAG chat surface (Story 7.4).
 *
 * Wires `POST /api/v1/chat` (SSE-streamed). The server emits typed events
 * (`retrieval` / `delta` / `done` / `error`) that this UI accumulates
 * into the assistant's reply with citation chips populating inline.
 *
 * Faithfulness < 0.7 routes to the low-confidence empty-state copy per
 * FR30 (chat refuses ungrounded claims).
 */

import type { ChatEmptyState, ChatMessage, CitationRef } from '@aisecretary/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useAuth, useAuthStore } from '../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';
import { streamChat } from '../../lib/chat/sse-client';

export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatRoute,
});

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations: ReadonlyArray<CitationRef>;
  pending?: boolean;
  emptyState?: ChatEmptyState;
  errorCode?: string;
};

const SEED: ChatTurn[] = [
  {
    id: 'sys',
    role: 'assistant',
    text: 'Ask me about your meetings — I’ll cite the transcript spans I’m relying on.',
    citations: [],
  },
];

const EMPTY_STATE_COPY: Record<ChatEmptyState, string> = {
  confident: '',
  'low-confidence': 'Confidence is low — double-check before quoting.',
  'no-answer': "I don't have evidence for that in your meetings.",
  'off-topic': "That doesn't look like a question about your meetings.",
};

function ChatRoute() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [turns, setTurns] = useState<ChatTurn[]>(SEED);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const isStreaming = turns.some((t) => t.pending === true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || isStreaming || !user || !accessToken) return;
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    const priorMessages: ChatMessage[] = turns
      .filter((t) => t.id !== 'sys')
      .map((t) => ({ role: t.role, content: t.text }));

    setTurns((prev) => [
      ...prev,
      { id: userId, role: 'user', text: trimmed, citations: [] },
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        citations: [],
        pending: true,
      },
    ]);
    setDraft('');

    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    streamChat({
      baseUrl: resolveApiBaseUrl(),
      accessToken,
      body: {
        query: trimmed,
        messages: [...priorMessages, { role: 'user', content: trimmed }],
      },
      signal: ac.signal,
      onEvent: (event) => {
        setTurns((prev) =>
          prev.map((t) => {
            if (t.id !== assistantId) return t;
            switch (event.kind) {
              case 'retrieval':
                return { ...t, citations: event.citations };
              case 'delta':
                return { ...t, text: t.text + event.text };
              case 'done':
                return { ...t, pending: false, emptyState: event.emptyState };
              case 'error':
                return {
                  ...t,
                  pending: false,
                  errorCode: event.code,
                  text: t.text.length > 0 ? t.text : event.message,
                };
              default:
                return t;
            }
          }),
        );
      },
    }).catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? {
                ...t,
                pending: false,
                errorCode: 'network',
                text: 'Network hiccup. Try again.',
              }
            : t,
        ),
      );
    });
  };

  return (
    <section className="mx-auto flex h-full max-w-3xl flex-col gap-4 px-6 py-6">
      <header className="flex items-center gap-3">
        <h1 className="font-sans text-2xl font-semibold">Chat</h1>
        <span className="text-xs text-fg-muted">Grounded in your meetings · cites every claim</span>
      </header>

      <ol className="flex flex-1 flex-col gap-3 overflow-y-auto" data-testid="chat-turns">
        {turns.map((turn) => {
          const emptyStateBanner =
            turn.emptyState && turn.emptyState !== 'confident'
              ? EMPTY_STATE_COPY[turn.emptyState]
              : null;
          return (
            <li
              key={turn.id}
              className={`flex max-w-[85%] flex-col gap-1 rounded-lg p-3 ${
                turn.role === 'user'
                  ? 'self-end bg-accent text-bg'
                  : 'self-start border border-border bg-surface text-fg'
              }`}
              data-testid={`chat-turn-${turn.role}`}
              aria-busy={turn.pending ? 'true' : 'false'}
            >
              <span className="text-xs uppercase tracking-wide opacity-70">
                {turn.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <p className="text-sm whitespace-pre-wrap">
                {turn.text || (turn.pending ? 'Searching your meetings…' : '')}
              </p>
              {turn.citations.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1" data-testid="chat-citations">
                  {turn.citations.map((c, idx) => (
                    <li
                      key={`${turn.id}-cite-${c.turnId ?? idx}`}
                      className="rounded-full bg-bg/40 px-2 py-0.5 font-mono text-[10px]"
                    >
                      [{idx + 1}] {c.spanStartMs ? `${Math.floor(c.spanStartMs / 1000)}s` : '·'}
                    </li>
                  ))}
                </ul>
              ) : null}
              {emptyStateBanner ? (
                <p
                  className="mt-1 rounded bg-warning-soft px-2 py-1 text-xs text-fg"
                  data-testid={`chat-empty-${turn.emptyState}`}
                >
                  {emptyStateBanner}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask about your meetings
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your meetings…"
          className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0 || isStreaming}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="chat-send"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </button>
      </form>
    </section>
  );
}
