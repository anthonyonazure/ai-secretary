import { type MeetingsListResponse, meetingsListResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth, useAuthStore } from '../hooks/use-auth';
import {
  type MeetingFilterRow,
  type MeetingTimeFilter,
  filterMeetings,
} from '../hooks/use-meeting-filter';
import { resolveApiBaseUrl } from '../lib/auth/api-client';

const fetchMeetings = async (accessToken: string | null): Promise<MeetingsListResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${resolveApiBaseUrl()}/api/v1/meetings?limit=20`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load meetings (${res.status})`);
  }
  return meetingsListResponseSchema.parse(await res.json());
};

const TIME_FILTERS: ReadonlyArray<{ id: MeetingTimeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This week' },
  { id: 'older', label: 'Older' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [timeFilter, setTimeFilter] = useState<MeetingTimeFilter>('all');

  const meetingsQuery = useQuery({
    queryKey: ['meetings', 'list', user?.id ?? 'anon'],
    queryFn: () => fetchMeetings(accessToken),
    enabled: !!user && !!accessToken,
    staleTime: 30_000,
  });

  const filterRows = useMemo<ReadonlyArray<MeetingFilterRow>>(
    () =>
      (meetingsQuery.data?.items ?? []).map((m) => ({
        id: m.id,
        title: m.title || 'Untitled meeting',
        startedAt: m.startedAt,
        moduleId: null,
        attendeeNames: [],
      })),
    [meetingsQuery.data],
  );

  const visible = useMemo(
    () =>
      filterMeetings(filterRows, {
        time: timeFilter,
        moduleId: null,
        attendeeName: null,
        query: '',
      }),
    [filterRows, timeFilter],
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Inbox', headerShown: true }} />
      <View className="flex-row gap-2 px-4 py-3" testID="inbox-filter-row">
        {TIME_FILTERS.map((f) => {
          const active = timeFilter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setTimeFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text className={`text-xs ${active ? 'text-fg' : 'text-fg-muted'}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {meetingsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fff" />
        </View>
      ) : meetingsQuery.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg" accessibilityRole="alert">
            Couldn’t load your meetings.
          </Text>
        </View>
      ) : visible.length === 0 ? (
        <EmptyState hasAnyMeetings={filterRows.length > 0} />
      ) : (
        <ScrollView className="flex-1 px-4">
          {visible.map((m) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}` as never}
              asChild
              testID={`inbox-meeting-${m.id}`}
            >
              <Pressable className="mb-3 rounded-md border border-border bg-surface p-4">
                <Text className="text-base font-semibold text-fg">{m.title}</Text>
                <Text className="mt-1 text-xs text-fg-muted">
                  {m.startedAt ? new Date(m.startedAt).toLocaleString() : 'Not yet started'}
                </Text>
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      )}

      <View className="border-border border-t bg-surface p-4">
        <Link href="/record" asChild>
          <Pressable
            className="items-center rounded-md bg-accent px-4 py-3"
            accessibilityRole="button"
            testID="inbox-record-cta"
          >
            <Text className="font-semibold text-bg">Start recording</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function EmptyState({ hasAnyMeetings }: { hasAnyMeetings: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" testID="inbox-empty-state">
      <Text className="text-center text-base text-fg">
        {hasAnyMeetings
          ? 'No meetings match this filter.'
          : 'Welcome — let’s see what AI Secretary does.'}
      </Text>
      <Text className="text-center text-sm text-fg-muted">
        {hasAnyMeetings
          ? 'Try a different filter or start a new recording below.'
          : 'Record your first meeting or import an existing audio file.'}
      </Text>
    </View>
  );
}
