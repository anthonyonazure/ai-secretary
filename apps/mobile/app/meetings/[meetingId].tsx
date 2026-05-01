import { type ListActionItemsResponse, listActionItemsResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useSpeakerTurns } from '../../components/analysis/use-speaker-turns';
import { useAuth, useAuthStore } from '../../hooks/use-auth';
import {
  type MeetingDetailTab,
  deriveMeetingDetailTabs,
} from '../../hooks/use-meeting-detail-tabs';
import { resolveApiBaseUrl } from '../../lib/auth/api-client';

const TAB_LABELS: Record<MeetingDetailTab, string> = {
  receipt: 'Receipt',
  transcript: 'Transcript',
  analysis: 'Analysis',
  actions: 'Actions',
  shares: 'Shares',
  audit: 'Audit',
};

const fetchMeetingActionItems = async (
  meetingId: string,
  accessToken: string | null,
): Promise<ListActionItemsResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const url = new URL(`${resolveApiBaseUrl()}/api/v1/action-items`);
  url.searchParams.set('meetingId', meetingId);
  url.searchParams.set('limit', '50');
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Failed to load action items (${res.status})`);
  }
  return listActionItemsResponseSchema.parse(await res.json());
};

export default function MeetingDetailScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);

  const turnsQuery = useSpeakerTurns(meetingId);

  const actionItemsQuery = useQuery({
    queryKey: ['meeting-action-items', meetingId, user?.id ?? 'anon'],
    queryFn: () => fetchMeetingActionItems(meetingId ?? '', accessToken),
    enabled: !!meetingId && !!user && !!accessToken,
    staleTime: 30_000,
  });

  const turns = turnsQuery.turns;
  const actionItems = actionItemsQuery.data?.items ?? [];
  const isAdmin = user?.role === 'super_admin' || user?.role === 'org_admin';

  const tabs = useMemo(
    () =>
      deriveMeetingDetailTabs({
        hasTranscript: turns.length > 0,
        hasAnalysis: false,
        actionItemCount: actionItems.length,
        shareCount: 0,
        isAdmin,
      }),
    [turns.length, actionItems.length, isAdmin],
  );
  const [activeTab, setActiveTab] = useState<MeetingDetailTab>(tabs.defaultTab);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: 'Meeting', headerShown: true, headerBackTitle: 'Back' }} />

      <ScrollView
        horizontal
        className="border-border border-b"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row gap-1 py-2">
          {tabs.visibleTabs.map((tab) => {
            const active = activeTab === tab;
            const badge = tabs.badges[tab];
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`flex-row items-center rounded-full px-3 py-1.5 ${
                  active ? 'bg-accent-soft' : 'bg-transparent'
                }`}
                testID={`meeting-tab-${tab}`}
              >
                <Text className={`text-sm ${active ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
                  {TAB_LABELS[tab]}
                </Text>
                {badge !== null ? (
                  <View className="ml-2 rounded-full bg-accent px-2 py-0.5">
                    <Text className="text-[10px] font-semibold text-bg">{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView className="flex-1 p-4">
        <Text className="mb-2 text-xs text-fg-muted" testID="meeting-id-display">
          {meetingId}
        </Text>
        {activeTab === 'receipt' ? (
          <Text className="text-base text-fg">Summary lands here once analysis completes.</Text>
        ) : activeTab === 'transcript' ? (
          turnsQuery.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : turnsQuery.isError ? (
            <Text className="text-fg" accessibilityRole="alert">
              Couldn’t load transcript.
            </Text>
          ) : turns.length === 0 ? (
            <Text className="text-fg-muted">Transcript not yet available.</Text>
          ) : (
            turns.map((turn) => (
              <View
                key={turn.turnId}
                className="mb-3 rounded-md border border-border bg-surface p-3"
                testID={`turn-${turn.turnId}`}
              >
                <Text className="mb-1 text-xs text-fg-muted">
                  {turn.speaker ?? 'Speaker'} · {Math.floor(turn.spanStartMs / 1000)}s
                </Text>
                <Text className="text-sm text-fg">{turn.text}</Text>
              </View>
            ))
          )
        ) : activeTab === 'analysis' ? (
          <Text className="text-base text-fg">Module-specific analysis lands here.</Text>
        ) : activeTab === 'actions' ? (
          actionItemsQuery.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : actionItems.length === 0 ? (
            <Text className="text-fg-muted">No action items extracted yet.</Text>
          ) : (
            actionItems.map((item) => (
              <View
                key={item.id}
                className="mb-2 rounded-md border border-border bg-surface p-3"
                testID={`meeting-action-${item.id}`}
              >
                <Text className="text-base text-fg">{item.text}</Text>
                <Text className="mt-1 text-xs text-fg-muted">
                  {item.dueDate
                    ? `Due ${new Date(item.dueDate).toLocaleDateString()}`
                    : 'No due date'}{' '}
                  · {item.status}
                </Text>
              </View>
            ))
          )
        ) : activeTab === 'shares' ? (
          <Text className="text-base text-fg">Shares + recipients land here.</Text>
        ) : (
          <Text className="text-base text-fg">Audit log slice for admins.</Text>
        )}
      </ScrollView>
    </View>
  );
}
