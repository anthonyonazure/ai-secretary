import { type SearchResponse, searchResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useId, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth, useAuthStore } from '../hooks/use-auth';
import { deriveSearchState } from '../hooks/use-search-state';
import { plainSnippet } from '../hooks/use-transcript-snippet';
import { resolveApiBaseUrl } from '../lib/auth/api-client';

const fetchSearch = async (q: string, accessToken: string | null): Promise<SearchResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(
    `${resolveApiBaseUrl()}/api/v1/search?q=${encodeURIComponent(q)}&limit=20`,
    { headers },
  );
  if (!res.ok) {
    if (res.status === 429) throw new Error('rate-limited');
    throw new Error('server');
  }
  return searchResponseSchema.parse(await res.json());
};

export default function SearchScreen() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const inputId = useId();

  const searchQuery = useQuery({
    queryKey: ['search', submitted, user?.id ?? 'anon'],
    queryFn: () => fetchSearch(submitted, accessToken),
    enabled: submitted.length >= 2 && !!user && !!accessToken,
    staleTime: 30_000,
  });

  const state = deriveSearchState({
    query: submitted,
    isFetching: searchQuery.isFetching,
    results: searchQuery.data?.items ?? [],
    error: searchQuery.isError
      ? { kind: searchQuery.error?.message === 'rate-limited' ? 'rate-limited' : 'server' }
      : null,
  });

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Search', headerShown: true }} />

      <View className="px-4 py-3">
        <Text className="sr-only" nativeID={inputId}>
          Search meetings
        </Text>
        <TextInput
          accessibilityLabelledBy={inputId}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmitted(query.trim())}
          placeholder="Search meetings, transcripts, summaries…"
          placeholderTextColor="#999"
          returnKeyType="search"
          className="rounded-md border border-border bg-surface p-3 text-fg"
          testID="search-input"
        />
      </View>

      {state.kind === 'pending' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fff" />
        </View>
      ) : state.kind === 'idle' ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-fg-muted">{state.copy}</Text>
        </View>
      ) : state.kind === 'error' || state.kind === 'rate-limited' ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-danger" accessibilityRole="alert">
            {state.copy}
          </Text>
        </View>
      ) : state.kind === 'no-results' ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-fg-muted" testID="search-empty">
            {state.copy}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4">
          <Text className="mb-3 text-xs text-fg-muted" testID="search-result-count">
            {state.copy}
          </Text>
          {(searchQuery.data?.items ?? []).map((hit, idx) => (
            <Link
              key={`${hit.meetingId}-${hit.turnId ?? idx}`}
              href={`/meetings/${hit.meetingId}` as never}
              asChild
              testID={`search-result-${idx}`}
            >
              <Pressable className="mb-2 rounded-md border border-border bg-surface p-3">
                <Text className="text-base font-semibold text-fg">{hit.meetingTitle}</Text>
                <Text className="mt-1 text-sm text-fg-muted">{plainSnippet(hit.snippet)}</Text>
                {hit.spanStartMs !== null ? (
                  <Text className="mt-1 font-mono text-[10px] text-fg-muted">
                    @ {Math.floor(hit.spanStartMs / 1000)}s · {hit.source}
                    {hit.speaker ? ` · ${hit.speaker}` : ''}
                  </Text>
                ) : (
                  <Text className="mt-1 font-mono text-[10px] text-fg-muted">{hit.source}</Text>
                )}
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
