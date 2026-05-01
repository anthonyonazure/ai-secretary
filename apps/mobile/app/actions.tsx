import {
  type ActionItemRow,
  type ListActionItemsResponse,
  listActionItemsResponseSchema,
} from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import {
  type ActionItemTab,
  bucketActionItem,
  filterActionItems,
} from '../hooks/use-action-items-filter';
import { useAuth, useAuthStore } from '../hooks/use-auth';
import { resolveApiBaseUrl } from '../lib/auth/api-client';

type Bucket = 'overdue' | 'today' | 'upcoming' | 'no-date';

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  'no-date': 'No date',
};

const FILTER_OPTIONS: ReadonlyArray<{ id: ActionItemTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
];

const TAB_TO_STATUS_QUERY: Record<ActionItemTab, string | null> = {
  all: null,
  open: 'pending,accepted',
  done: 'done',
};

const fetchActionItems = async (
  tab: ActionItemTab,
  accessToken: string | null,
): Promise<ListActionItemsResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const status = TAB_TO_STATUS_QUERY[tab];
  const url = new URL(`${resolveApiBaseUrl()}/api/v1/action-items`);
  url.searchParams.set('limit', '50');
  if (status) url.searchParams.set('status', status);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Failed to load action items (${res.status})`);
  }
  return listActionItemsResponseSchema.parse(await res.json());
};

export default function ActionsScreen() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<ActionItemTab>('open');

  const itemsQuery = useQuery({
    queryKey: ['action-items', tab, user?.id ?? 'anon'],
    queryFn: () => fetchActionItems(tab, accessToken),
    enabled: !!user && !!accessToken,
    staleTime: 30_000,
  });

  const items = itemsQuery.data?.items ?? [];

  const filtered = useMemo(() => filterActionItems(items, { tab }), [items, tab]);

  const grouped = useMemo(() => {
    const groups: Record<Bucket, ActionItemRow[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      'no-date': [],
    };
    for (const item of filtered) {
      groups[bucketActionItem(item)].push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'My Actions', headerShown: true }} />

      <View className="flex-row gap-2 px-4 py-3" testID="actions-filter-row">
        {FILTER_OPTIONS.map((opt) => {
          const active = tab === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setTab(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-xs ${active ? 'text-fg' : 'text-fg-muted'}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {itemsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fff" />
        </View>
      ) : itemsQuery.isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-fg" accessibilityRole="alert">
            Couldn’t load your action items.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4">
          {(['overdue', 'today', 'upcoming', 'no-date'] as Bucket[]).map((bucket) => {
            const bucketItems = grouped[bucket];
            if (bucketItems.length === 0) return null;
            return (
              <View key={bucket} className="mb-4">
                <Text
                  className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
                    bucket === 'overdue' ? 'text-danger' : 'text-fg-muted'
                  }`}
                >
                  {BUCKET_LABEL[bucket]} · {bucketItems.length}
                </Text>
                {bucketItems.map((item) => (
                  <View
                    key={item.id}
                    className="mb-2 rounded-md border border-border bg-surface p-3"
                    testID={`action-item-${item.id}`}
                  >
                    <Text className="text-base text-fg">{item.text}</Text>
                    <Text className="mt-1 text-xs text-fg-muted">
                      {item.dueDate
                        ? `Due ${new Date(item.dueDate).toLocaleDateString()}`
                        : 'No due date'}{' '}
                      · {item.status} · from {item.meetingTitle}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
          {filtered.length === 0 ? (
            <Text className="mt-8 text-center text-fg-muted" testID="actions-empty-state">
              Nothing here — record a meeting to extract action items.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
