import type { ChatEmptyState, ChatMessage, CitationRef } from '@aisecretary/shared';
import { Stack } from 'expo-router';
import { useEffect, useId, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth, useAuthStore } from '../hooks/use-auth';
import { resolveApiBaseUrl } from '../lib/auth/api-client';
import { streamChat } from '../lib/chat/sse-client';

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
    id: 'seed-1',
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

export default function ChatScreen() {
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
      .filter((t) => t.id !== 'seed-1')
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
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Chat', headerShown: true }} />

      <ScrollView className="flex-1 px-4 py-3" testID="chat-turns">
        {turns.map((turn) => {
          const banner =
            turn.emptyState && turn.emptyState !== 'confident'
              ? EMPTY_STATE_COPY[turn.emptyState]
              : null;
          return (
            <View
              key={turn.id}
              className={`mb-3 max-w-[85%] rounded-lg p-3 ${
                turn.role === 'user'
                  ? 'self-end bg-accent'
                  : 'self-start border border-border bg-surface'
              }`}
              testID={`chat-turn-${turn.role}`}
              accessibilityState={{ busy: turn.pending ?? false }}
            >
              <Text
                className={`mb-1 text-[10px] uppercase ${
                  turn.role === 'user' ? 'text-bg' : 'text-fg-muted'
                }`}
              >
                {turn.role === 'user' ? 'You' : 'Assistant'}
              </Text>
              <Text className={`text-sm ${turn.role === 'user' ? 'text-bg' : 'text-fg'}`}>
                {turn.text || (turn.pending ? 'Searching your meetings…' : '')}
              </Text>
              {turn.citations.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-1" testID="chat-citations">
                  {turn.citations.map((c, idx) => (
                    <View
                      key={`${turn.id}-cite-${c.turnId ?? idx}`}
                      className="rounded-full bg-bg/40 px-2 py-0.5"
                    >
                      <Text className="font-mono text-[10px] text-fg">
                        [{idx + 1}] {c.spanStartMs ? `${Math.floor(c.spanStartMs / 1000)}s` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {banner ? (
                <Text
                  className="mt-2 rounded bg-warning-soft px-2 py-1 text-xs text-fg"
                  testID={`chat-empty-${turn.emptyState}`}
                >
                  {banner}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View className="border-border border-t bg-surface p-3">
        <Text className="sr-only" nativeID={inputId}>
          Ask about your meetings
        </Text>
        <View className="flex-row gap-2">
          <TextInput
            accessibilityLabelledBy={inputId}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder="Ask about your meetings…"
            placeholderTextColor="#999"
            returnKeyType="send"
            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-fg"
            testID="chat-input"
          />
          <Pressable
            onPress={send}
            disabled={draft.trim().length === 0 || isStreaming}
            accessibilityRole="button"
            className={`rounded-md px-4 py-2 ${
              draft.trim().length === 0 || isStreaming ? 'bg-fg-muted' : 'bg-accent'
            }`}
            testID="chat-send"
          >
            <Text className="font-semibold text-bg">Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
